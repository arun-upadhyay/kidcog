/**
 * Grading of open-ended answers.
 *
 * Design notes worth keeping in mind as you extend this:
 *
 * 1. Multiple-choice items are NEVER sent to the model. They have a known
 *    correct answer, so grading them with a language model would only add
 *    cost, latency and the chance of a wrong grade. See scoring.ts.
 *
 * 2. All open answers go in ONE request. Batching keeps latency and cost down
 *    and lets the model see the child's work as a whole.
 *
 * 3. The model is asked for strict JSON via a schema, so we never parse prose.
 *
 * 4. Temperature is 0. Grading should be as repeatable as we can make it — two
 *    identical submissions ought to produce the same score.
 */

import OpenAI from 'openai';
import { OPEN_MAX_POINTS } from './questions.js';
import type { Grade, GradeRequestItem, Report } from './types.js';

const SYSTEM_PROMPT = `You are grading short written answers from a child aged 7-12 who is taking a cognitive reasoning practice test.

Grade ONLY against the rubric you are given for each item. Award the highest band the answer fully satisfies.

Rules you must follow:
- Judge the reasoning, not the writing. Spelling, grammar, handwriting-style typos and short answers must never lower a score. A correct idea expressed in four words scores as well as one expressed in four sentences.
- Do not reward length, confidence, or vocabulary that goes beyond the rubric.
- If an answer is blank, off-topic, or impossible to interpret, score 0.
- If an answer could plausibly meet a higher band, give the higher band. When genuinely undecidable between two bands, give the lower one and say why in the note.
- Write each note for the child's parent or teacher: one or two plain sentences, specific to what the child actually wrote, and constructive. Never speculate about the child's intelligence, ability level, diagnosis, or home life.

Return one entry per item, in the same order you received them.`;

function buildUserPrompt(items: GradeRequestItem[]): string {
  const blocks = items.map((it, i) =>
    [
      `### Item ${i + 1} (id: ${it.id}, domain: ${it.domain})`,
      `QUESTION: ${it.prompt}`,
      `RUBRIC (0-${OPEN_MAX_POINTS}):`,
      it.rubric.map((r) => `  ${r}`).join('\n'),
      `CHILD'S ANSWER: """${(it.answer ?? '').slice(0, 2000)}"""`,
    ].join('\n')
  );

  return `Grade each of the following ${items.length} item(s).\n\n${blocks.join('\n\n')}`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['grades'],
  properties: {
    grades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'points', 'note'],
        properties: {
          id: { type: 'string', description: 'The item id exactly as given.' },
          points: {
            type: 'integer',
            description: `Rubric band awarded, 0 to ${OPEN_MAX_POINTS}.`,
          },
          note: {
            type: 'string',
            description: 'One or two plain sentences for a parent or teacher.',
          },
        },
      },
    },
  },
} as const;

/** What we expect back after JSON.parse — validated before use, never trusted. */
interface GraderResponse {
  grades?: Array<{ id?: string; points?: unknown; note?: unknown }>;
}

/**
 * Development stand-in so you can run the whole pipeline without an API key or
 * spending tokens. It is deliberately crude — it is NOT a scoring strategy.
 */
function mockGrade(items: GradeRequestItem[]): Grade[] {
  return items.map((it) => {
    const text = (it.answer ?? '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    let points = 0;
    if (words >= 25) points = 3;
    else if (words >= 10) points = 2;
    else if (words >= 1) points = 1;
    return {
      id: it.id,
      points,
      note: `[mock grader] Scored from answer length only (${words} words). Set USE_MOCK_GRADER=0 for real grading.`,
    };
  });
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Add it to server/.env, or set USE_MOCK_GRADER=1.');
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function gradeOpenAnswers(items: GradeRequestItem[]): Promise<Grade[]> {
  if (items.length === 0) return [];

  if (process.env.USE_MOCK_GRADER === '1') {
    return mockGrade(items);
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const completion = await getClient().chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(items) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'grades', strict: true, schema: RESPONSE_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Grader returned an empty response.');

  let parsed: GraderResponse;
  try {
    parsed = JSON.parse(raw) as GraderResponse;
  } catch {
    throw new Error('Grader returned malformed JSON.');
  }

  const byId = new Map((parsed.grades ?? []).map((g) => [g.id, g]));

  // Never trust the model's arithmetic or completeness. Clamp every band and
  // fill in anything it skipped so one bad grade cannot corrupt the report.
  return items.map((it): Grade => {
    const g = byId.get(it.id);
    if (!g) {
      return {
        id: it.id,
        points: 0,
        note: 'Not graded — the grader skipped this item.',
        incomplete: true,
      };
    }
    const points = Math.max(0, Math.min(OPEN_MAX_POINTS, Math.round(Number(g.points) || 0)));
    return { id: it.id, points, note: String(g.note ?? '').slice(0, 500) };
  });
}

/**
 * A short parent-facing summary written from the finished report. Kept separate
 * from grading so a failure here never blocks the scores.
 */
export async function summariseForParent(report: Report, childName?: string): Promise<string> {
  if (process.env.USE_MOCK_GRADER === '1') {
    return '[mock] A written summary appears here when the real grader is enabled.';
  }

  const lines = report.domains
    .map((d) => `- ${d.label}: ${d.earned}/${d.possible} points (${d.percent}%)`)
    .join('\n');

  const completion = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `You write short, warm, plain-language summaries of a child's practice reasoning test for their parent.

Hard rules:
- Never give or imply an IQ number, a percentile, a mental age, a diagnosis, or a comparison to other children. You have no data to support any of those.
- Describe only what this test session showed: which kinds of questions went smoothly and which were harder.
- Lead with a strength. Frame weaker areas as things to practise, never as deficits.
- 3 to 5 sentences, no headings, no bullet points.
- End by noting that this is a practice activity and a single session does not measure a child's ability.`,
      },
      {
        role: 'user',
        content: `Child's first name: ${childName || 'the child'}\n\nResults by area:\n${lines}\n\nOverall: ${report.overall.earned}/${report.overall.possible} (${report.overall.percent}%).`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? '';
}
