/**
 * Draft new questions with the model.
 *
 *   npm run generate -- --domain pattern_reasoning --count 5 --age 8-12
 *   npm run generate -- --domain verbal_reasoning --count 3 --type open
 *
 * Output goes to `drafts/questions-<timestamp>.ts`. It does NOT go into the
 * question bank, and that is deliberate.
 *
 * Why drafts and not straight into the bank
 * -----------------------------------------
 * Models are good at producing questions that LOOK like good test items and
 * are subtly broken: two defensible answers, an answer that depends on
 * knowledge rather than reasoning, a sequence with more than one valid rule, a
 * "correct" option that is simply wrong. None of those are visible from the
 * shape of the JSON, and every one of them punishes a child for being right.
 *
 * So this script does three things beyond asking for questions:
 *   1. Validates the structure with zod, so malformed items never reach you.
 *   2. Runs a second, adversarial pass that tries to break each item, and
 *      attaches the critique as a comment above it.
 *   3. Writes everything to a drafts file for you to read, fix and move across
 *      by hand.
 *
 * Step 3 is the one that matters. Read them before you use them.
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';

import { DOMAINS, QUESTIONS } from './questions.js';
import type { DomainKey } from './types.js';

// --- Validation -------------------------------------------------------------

const DOMAIN_KEYS = Object.keys(DOMAINS) as [DomainKey, ...DomainKey[]];

const McqSchema = z.object({
  id: z.string().min(2).max(40),
  domain: z.enum(DOMAIN_KEYS),
  type: z.literal('mcq'),
  ageBand: z.tuple([z.number().int().min(4).max(18), z.number().int().min(4).max(18)]),
  weight: z.number().int().min(1).max(3),
  prompt: z.string().min(5),
  options: z.array(z.object({ key: z.string().min(1).max(2), text: z.string().min(1) })).min(3).max(5),
  answerKey: z.string().min(1).max(2),
});

const OpenSchema = z.object({
  id: z.string().min(2).max(40),
  domain: z.enum(DOMAIN_KEYS),
  type: z.literal('open'),
  ageBand: z.tuple([z.number().int().min(4).max(18), z.number().int().min(4).max(18)]),
  weight: z.number().int().min(1).max(3),
  prompt: z.string().min(5),
  timeLimitSeconds: z.number().int().min(30).max(600).optional(),
  rubric: z.array(z.string().min(5)).length(4),
});

const DraftSchema = z.discriminatedUnion('type', [McqSchema, OpenSchema]);
type Draft = z.infer<typeof DraftSchema>;

/** Checks the schema cannot express: the answer key must name a real option. */
function structuralProblems(q: Draft): string[] {
  const problems: string[] = [];
  if (q.ageBand[0] > q.ageBand[1]) problems.push('ageBand is reversed');
  if (q.type === 'mcq') {
    const keys = q.options.map((o) => o.key);
    if (!keys.includes(q.answerKey)) problems.push(`answerKey "${q.answerKey}" is not one of the options`);
    if (new Set(keys).size !== keys.length) problems.push('duplicate option keys');
    const texts = q.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) problems.push('two options have the same text');
  }
  return problems;
}

// --- Generation -------------------------------------------------------------

const GENERATE_SYSTEM = `You write reasoning questions for children aged 7-12, for a practice activity.

What makes an item usable:
- It tests reasoning, not knowledge. A child who has never heard of the subject should still be able to work it out from what is in front of them. No trivia, no vocabulary a 7-year-old would not meet, no cultural assumptions.
- It has exactly ONE defensible answer. For sequences, exactly one rule must fit; if a second rule also fits the given terms, the item is broken.
- Distractors are wrong but tempting: the answer you get from a plausible mistake, not filler.
- The wording is short and unambiguous. A child failing because the sentence was confusing tells you nothing.
- It is self-contained. No images, no diagrams. Use plain text and simple typed shapes if needed.

For open-ended items, the rubric must have exactly four bands, 3 down to 0, each describing what the ANSWER DEMONSTRATES rather than how long or polished it is. Band 0 is always blank, off-topic, or unintelligible.

Return ids in the form given to you. Do not reuse any existing id.`;

const DRAFT_SCHEMA_JSON = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'domain', 'type', 'ageBand', 'weight', 'prompt', 'options', 'answerKey', 'rubric', 'rationale'],
        properties: {
          id: { type: 'string' },
          domain: { type: 'string', enum: DOMAIN_KEYS },
          type: { type: 'string', enum: ['mcq', 'open'] },
          ageBand: { type: 'array', items: { type: 'integer' } },
          weight: { type: 'integer' },
          prompt: { type: 'string' },
          options: {
            type: ['array', 'null'],
            description: 'MCQ only; null for open items.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'text'],
              properties: { key: { type: 'string' }, text: { type: 'string' } },
            },
          },
          answerKey: { type: ['string', 'null'], description: 'MCQ only; null for open items.' },
          rubric: {
            type: ['array', 'null'],
            description: 'Open only; null for MCQ. Exactly four bands, 3 down to 0.',
            items: { type: 'string' },
          },
          rationale: {
            type: 'string',
            description: 'Why the correct answer is correct, and why each distractor is tempting.',
          },
        },
      },
    },
  },
} as const;

const CRITIQUE_SYSTEM = `You are reviewing draft reasoning questions for children aged 7-12. Your job is to find what is wrong with them, not to praise them.

For each item, check specifically:
- Is there more than one defensible answer? For sequences, does a second rule fit the given terms?
- Is the stated answer actually correct? Work it out yourself rather than trusting it.
- Does it require knowledge, vocabulary, or cultural familiarity rather than reasoning?
- Is the wording ambiguous to a child?
- Are the distractors obviously wrong, making it guessable without thinking?
- For open items: does any rubric band reward length or polish instead of reasoning? Are the bands genuinely distinguishable?

Be blunt and specific. If an item is sound, say so in one line. verdict is "ok" only when you would put it in front of a child as-is.`;

const CRITIQUE_SCHEMA_JSON = {
  type: 'object',
  additionalProperties: false,
  required: ['reviews'],
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'verdict', 'problems'],
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['ok', 'needs_work', 'broken'] },
          problems: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

// --- CLI --------------------------------------------------------------------

interface Args {
  domain: DomainKey;
  count: number;
  ageBand: [number, number];
  type: 'mcq' | 'open' | 'mixed';
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const domain = (get('domain') ?? 'pattern_reasoning') as DomainKey;
  if (!DOMAIN_KEYS.includes(domain)) {
    throw new Error(`--domain must be one of: ${DOMAIN_KEYS.join(', ')}`);
  }

  const count = Number(get('count') ?? 5);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('--count must be a whole number between 1 and 20');
  }

  const ageRaw = get('age') ?? '8-12';
  const parts = ageRaw.split('-').map(Number);
  const lo = parts[0];
  const hi = parts[1];
  if (parts.length !== 2 || lo === undefined || hi === undefined || Number.isNaN(lo) || Number.isNaN(hi) || lo > hi) {
    throw new Error('--age must look like 8-12');
  }

  const type = (get('type') ?? 'mixed') as Args['type'];
  if (!['mcq', 'open', 'mixed'].includes(type)) {
    throw new Error('--type must be mcq, open or mixed');
  }

  return { domain, count, ageBand: [lo, hi], type };
}

function serialise(q: Draft, review: { verdict: string; problems: string[] } | undefined): string {
  const header = review
    ? [
        `  // REVIEW: ${review.verdict.toUpperCase()}`,
        ...review.problems.map((p) => `  //   - ${p}`),
      ].join('\n')
    : '  // REVIEW: not reviewed';

  return `${header}\n${JSON.stringify(q, null, 2)
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n')},`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. This script makes real OpenAI calls (the mock grader does not apply here).');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const existingIds = QUESTIONS.map((q) => q.id);
  const samples = QUESTIONS.filter((q) => q.domain === args.domain).slice(0, 3);
  const prefix = args.domain.split('_').map((w) => w[0]).join('');

  console.log(`Drafting ${args.count} ${args.type} item(s) for ${DOMAINS[args.domain].label}, ages ${args.ageBand[0]}-${args.ageBand[1]}…`);

  const generation = await client.chat.completions.create({
    model,
    // Variety matters more than determinism when drafting. Omitted by default
    // because the gpt-6 family rejects an explicit temperature; see sampling()
    // in grader.ts.
    ...(process.env.OPENAI_SUPPORTS_TEMPERATURE === '1' ? { temperature: 0.8 } : {}),
    messages: [
      { role: 'system', content: GENERATE_SYSTEM },
      {
        role: 'user',
        content: [
          `Domain: ${args.domain} — ${DOMAINS[args.domain].blurb}`,
          `Write ${args.count} question(s). Type: ${args.type === 'mixed' ? 'a mix of mcq and open' : args.type}.`,
          `Age band: [${args.ageBand[0]}, ${args.ageBand[1]}]. Use ids starting "${prefix}-gen-" and do not reuse: ${existingIds.join(', ')}`,
          '',
          'Existing items in this domain, for tone and difficulty (do not duplicate them):',
          samples.map((q) => `- ${q.prompt}`).join('\n') || '(none yet)',
          '',
          'For mcq items set rubric to null. For open items set options and answerKey to null, and give exactly four rubric bands.',
        ].join('\n'),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'drafts', strict: true, schema: DRAFT_SCHEMA_JSON },
    },
  });

  const raw = generation.choices[0]?.message?.content;
  if (!raw) throw new Error('Generation returned nothing.');
  const produced = (JSON.parse(raw).questions ?? []) as Array<Record<string, unknown>>;

  // Strip the nulls the schema forced on us, then validate properly.
  const valid: Draft[] = [];
  const rejected: Array<{ raw: unknown; why: string }> = [];

  for (const item of produced) {
    const cleaned: Record<string, unknown> = { ...item };
    delete cleaned.rationale;
    for (const k of ['options', 'answerKey', 'rubric']) {
      if (cleaned[k] === null) delete cleaned[k];
    }
    if (cleaned.type === 'open' && cleaned.timeLimitSeconds === undefined) {
      cleaned.timeLimitSeconds = 180;
    }

    const parsed = DraftSchema.safeParse(cleaned);
    if (!parsed.success) {
      rejected.push({ raw: item, why: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      continue;
    }
    const problems = structuralProblems(parsed.data);
    if (problems.length > 0) {
      rejected.push({ raw: item, why: problems.join('; ') });
      continue;
    }
    if (existingIds.includes(parsed.data.id)) {
      rejected.push({ raw: item, why: `id "${parsed.data.id}" already exists` });
      continue;
    }
    valid.push(parsed.data);
  }

  console.log(`  ${valid.length} structurally valid, ${rejected.length} rejected.`);

  // --- Adversarial second pass ---
  let reviews = new Map<string, { verdict: string; problems: string[] }>();
  if (valid.length > 0) {
    console.log('Reviewing them for ambiguity and wrong answers…');
    const critique = await client.chat.completions.create({
      model,
      ...(process.env.OPENAI_SUPPORTS_TEMPERATURE === '1' ? { temperature: 0 } : {}),
      messages: [
        { role: 'system', content: CRITIQUE_SYSTEM },
        { role: 'user', content: JSON.stringify(valid, null, 2) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'reviews', strict: true, schema: CRITIQUE_SCHEMA_JSON },
      },
    });
    const cRaw = critique.choices[0]?.message?.content;
    if (cRaw) {
      const list = (JSON.parse(cRaw).reviews ?? []) as Array<{ id: string; verdict: string; problems: string[] }>;
      reviews = new Map(list.map((r) => [r.id, { verdict: r.verdict, problems: r.problems }]));
    }
  }

  const counts = { ok: 0, needs_work: 0, broken: 0, unreviewed: 0 };
  for (const q of valid) {
    const v = reviews.get(q.id)?.verdict;
    if (v === 'ok') counts.ok++;
    else if (v === 'needs_work') counts.needs_work++;
    else if (v === 'broken') counts.broken++;
    else counts.unreviewed++;
  }

  // --- Write the drafts file ---
  const dir = join(process.cwd(), 'drafts');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `questions-${stamp}.ts`);

  const body = [
    '/**',
    ` * DRAFT questions — generated ${new Date().toISOString()}`,
    ` * Domain: ${args.domain} | ages ${args.ageBand[0]}-${args.ageBand[1]} | requested ${args.count}`,
    ' *',
    ' * These are NOT in the question bank. Read every one, check the answer',
    ' * yourself, fix what the review flags, then paste the ones you trust into',
    ' * src/questions.ts.',
    ' *',
    ` * Review summary: ${counts.ok} ok, ${counts.needs_work} need work, ${counts.broken} broken, ${counts.unreviewed} unreviewed.`,
    ' */',
    '',
    "import type { Question } from '../src/types.js';",
    '',
    'export const DRAFTS = [',
    valid.map((q) => serialise(q, reviews.get(q.id))).join('\n\n'),
    '] satisfies Question[];',
    '',
    rejected.length > 0
      ? `/* Rejected before review:\n${rejected.map((r) => ` - ${r.why}`).join('\n')}\n*/\n`
      : '',
  ].join('\n');

  writeFileSync(file, body, 'utf8');

  console.log('');
  console.log(`Wrote ${valid.length} draft(s) to ${file}`);
  console.log(`  ok: ${counts.ok}   needs work: ${counts.needs_work}   broken: ${counts.broken}`);
  console.log('');
  console.log('Read them before using them. A generated question that looks fine and has two');
  console.log('valid answers will mark a child wrong for thinking correctly.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
