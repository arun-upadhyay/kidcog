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
import type { Grade, GradeRequestItem, ParentReport, Report } from './types.js';

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

// ---------------------------------------------------------------------------
// The written report for the parent.
// ---------------------------------------------------------------------------

const REPORT_SYSTEM_PROMPT = `You write reports for the parent of a child aged 7-12 who has just finished a practice reasoning activity. The parent is not an educator. Write as a thoughtful teacher would after sitting with their child for twenty minutes.

You are given every question, what the child answered, and how it scored. Ground everything you write in that evidence.

Hard rules — these are not style preferences:
- Never give or imply an IQ number, a percentile, a mental age, a rank, a diagnosis, or any comparison to other children. You have no data that could support such a claim, and a parent will believe a number you invent.
- Never speculate about a learning disability, a condition, or anything about the child's home or school life.
- Write only about what this session shows. One short activity is thin evidence and your tone should reflect that.
- Be specific. "Solved the bus timetable question by working out the gaps between departures" is worth more than "showed good numerical skills". Refer to what the child actually wrote or chose.
- Do not invent anything the child did not do. If the evidence is thin in some area, say less rather than padding.
- Lead with genuine strengths. Describe difficulties as things not yet clicked, never as deficits or failures.
- A wrong answer often shows real thinking. Where a wrong answer reveals a sensible approach, say so.
- Practice ideas must be things a parent can do at home this week with no special materials, and must connect to what you actually observed. No worksheets, no apps, no purchases.
- Plain language. No jargon, no bullet-point fragments — write complete sentences inside each item.`;

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['opening', 'strengths', 'stuckPoints', 'thinkingNotes', 'practiceIdeas', 'closing'],
  properties: {
    opening: {
      type: 'string',
      description: 'Two or three warm sentences opening the report, naming the child if a name was given.',
    },
    strengths: {
      type: 'array',
      description: '2-3 specific strengths, each one or two sentences, each tied to a particular question.',
      items: { type: 'string' },
    },
    stuckPoints: {
      type: 'array',
      description: '1-3 places the child struggled, each one or two sentences, phrased as observations.',
      items: { type: 'string' },
    },
    thinkingNotes: {
      type: 'string',
      description:
        'Two to four sentences on what the pattern across answers suggests about how the child approached the questions. If there is no clear pattern, say that plainly instead of inventing one.',
    },
    practiceIdeas: {
      type: 'array',
      description: '2-4 concrete things to try at home, each one or two sentences.',
      items: { type: 'string' },
    },
    closing: {
      type: 'string',
      description:
        'Two or three sentences noting what a single practice session can and cannot show, and encouraging the parent.',
    },
  },
} as const;

/** The evidence the model reasons over: every item, the answer, and the score. */
function buildEvidence(report: Report): string {
  const items = report.responses.map((r) => {
    const answer = r.answer.trim() || '(left blank)';
    let outcome: string;
    if (r.ungraded) {
      outcome = 'not graded';
    } else if (r.type === 'mcq') {
      outcome = r.correct ? 'correct' : 'incorrect';
    } else {
      outcome = `scored ${r.band ?? 0} of 3`;
    }
    const time = r.elapsedSeconds !== null ? `, took ${r.elapsedSeconds}s` : '';
    return [
      `[${r.domain}] ${r.prompt}`,
      `  child answered: ${answer}`,
      `  outcome: ${outcome}${time}`,
      r.note ? `  grader note: ${r.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });

  const domains = report.domains
    .map((d) => `- ${d.label}: ${d.earned}/${d.possible} points (${d.percent}%)`)
    .join('\n');

  return `Scores by area:\n${domains}\n\nOverall: ${report.overall.earned}/${report.overall.possible} (${report.overall.percent}%).\n\nEvery question, in the order taken:\n\n${items.join('\n\n')}`;
}

function mockReport(childName?: string): ParentReport {
  const who = childName || 'Your child';
  return {
    opening: `[mock] ${who} worked through all the questions. Set USE_MOCK_GRADER=0 in server/.env to get a real report written from the actual answers.`,
    strengths: ['[mock] Specific strengths, drawn from what the child actually answered, appear here.'],
    stuckPoints: ['[mock] Places the child struggled appear here.'],
    thinkingNotes: '[mock] Observations about how the child approached the questions appear here.',
    practiceIdeas: ['[mock] Things to try at home appear here.'],
    closing: '[mock] Closing note appears here.',
  };
}

/**
 * The written report, generated from the finished scores. Deliberately separate
 * from grading: if this fails, the scores still stand on their own.
 */
export async function generateParentReport(
  report: Report,
  childName?: string
): Promise<ParentReport> {
  if (process.env.USE_MOCK_GRADER === '1') {
    return mockReport(childName);
  }

  const completion = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.4,
    messages: [
      { role: 'system', content: REPORT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Child's first name: ${childName || '(not given — write without a name)'}\n\n${buildEvidence(report)}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'parent_report', strict: true, schema: REPORT_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Report generation returned an empty response.');

  let parsed: Partial<ParentReport>;
  try {
    parsed = JSON.parse(raw) as Partial<ParentReport>;
  } catch {
    throw new Error('Report generation returned malformed JSON.');
  }

  // Normalise defensively — a missing section should render as absent, not crash.
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s.trim().length > 0) : [];

  return {
    opening: String(parsed.opening ?? '').trim(),
    strengths: asList(parsed.strengths),
    stuckPoints: asList(parsed.stuckPoints),
    thinkingNotes: String(parsed.thinkingNotes ?? '').trim(),
    practiceIdeas: asList(parsed.practiceIdeas),
    closing: String(parsed.closing ?? '').trim(),
  };
}
