/** AI grades generated answers against their private rubrics; aggregate only completed grades. */

import type { GeneratedQuestion } from './generatedQuestions.js';
import { generatedQuestionById as questionById, OPEN_MAX_POINTS } from './generatedQuestions.js';
import { TRAITS, TRAIT_ORDER, formScaleFor } from './traits.js';
import { gradeOpenAnswers } from './grader.js';
import type {
  Grade,
  GradeRequestItem,
  OpenQuestion,
  Report,
  ResponseInput,
  ScoredResponse,
  TraitKey,
  TraitReport,
} from './types.js';

function pct(earned: number, possible: number): number {
  if (possible === 0) return 0;
  return Math.round((earned / possible) * 100);
}

/** A qualitative label — describes this session, not the child. */
function band(percent: number): string {
  if (percent >= 85) return 'Handled comfortably in this session';
  if (percent >= 65) return 'Mostly solid, with a few sticking points';
  if (percent >= 40) return 'Some worked, some were challenging';
  return 'Challenging in this session';
}

/** How much weight a parent should give this row. */
function evidenceNote(count: number, measurable: string): string {
  if (count === 0) {
    return measurable === 'inferred'
      ? 'Not seen — this shows up in how a child explains their thinking, and there were no written or spoken answers to read.'
      : 'Not seen in this session.';
  }
  if (count === 1) return 'One question only — treat this as a hint, not a measure.';
  if (count === 2) return 'Two questions — thin, but a starting point.';
  return `${count} questions.`;
}

export async function scoreSubmission(responses: ResponseInput[]): Promise<Report> {
  const items: Array<{ q: GeneratedQuestion; answer: string; elapsedSeconds: number | null }> = [];

  for (const r of responses) {
    const q = questionById(r.questionId);
    if (!q) throw new Error('A generated question has expired. Start a new session.');
    items.push({ q, answer: r.answer, elapsedSeconds: r.elapsedSeconds ?? null });
  }

  const results: ScoredResponse[] = [];
  const openItems: GradeRequestItem[] = [];

  for (const { q, answer, elapsedSeconds } of items) {
    const possible = q.weight * OPEN_MAX_POINTS;

    if (!answer.trim()) {
      results.push({ questionId: q.id, trait: q.trait, type: q.type, prompt: q.prompt,
        answer, earned: 0, possible: 0, elapsedSeconds, skipped: true,
        note: 'Skipped — no evidence to score.' });
      continue;
    }
    if (q.type === 'mcq') {
      const chosen = answer.trim().toLowerCase();
      const correct = chosen === q.answerKey.toLowerCase();
      results.push({
        questionId: q.id,
        trait: q.trait,
        type: 'mcq',
        prompt: q.prompt,
        answer,
        earned: correct ? possible : 0,
        possible,
        elapsedSeconds,
        correct,
        band: correct ? OPEN_MAX_POINTS : 0,
        note: correct
          ? 'That picture or choice matches the answer.'
          : `The selected choice did not match. The answer was ${
              q.options.find((option) => option.key === q.answerKey)?.text ?? q.answerKey
            }.`,
      });
      continue;
    }

    {
      openItems.push({
        id: q.id,
        trait: q.trait,
        prompt: `${q.prompt} ${q.visual ?? ''}`,
        rubric: q.rubric,
        answer,
      });
      results.push({
        questionId: q.id,
        trait: q.trait,
        type: q.type,
        prompt: q.prompt,
        answer,
        earned: 0, // filled in below
        possible,
        elapsedSeconds,
        note: '',
      });
    }
  }

  // --- Open ended: one batched call to the grader. ---
  let graderFailed: string | null = null;
  let grades: Grade[] = [];

  if (openItems.length > 0) {
    try {
      grades = await gradeOpenAnswers(openItems);
      const byId = new Map(grades.map((g) => [g.id, g]));
      for (const row of results) {
        if (row.skipped || row.type !== 'open') continue;
        const g = byId.get(row.questionId);
        const q = questionById(row.questionId);
        if (!g || g.incomplete) {
          row.ungraded = true;
          row.possible = 0;
          row.note = 'AI did not grade this answer. It is excluded from scores.';
        } else if (q && !row.skipped) {
          row.band = g.points;
          row.earned = g.points * q.weight;
          row.note = g.note;
        }
      }
    } catch (err) {
      graderFailed = err instanceof Error ? err.message : String(err);
      console.error(`\n  x GRADING FAILED — ${openItems.length} written answer(s) left ungraded`);
      console.error(`    ${graderFailed}\n`);
      for (const row of results) {
        if (!row.skipped && row.type === 'open') {
          row.note = 'Could not be graded automatically — needs a human read.';
          row.ungraded = true;
          row.possible = 0; // keep it out of the totals rather than counting it wrong
        }
      }
    }
  }

  // --- Aggregate by trait. ---
  const traits: TraitReport[] = [];

  for (const key of TRAIT_ORDER) {
    const meta = TRAITS[key];

    // A skipped or ungraded row carries no evidence about this trait, so it is
    // left out of both the score and the count of how much was seen. Counting
    // it would make a thin session look better evidenced than it was.
    const rows = results.filter((r) => r.trait === key && !r.skipped && !r.ungraded);
    const earned = rows.reduce((s, r) => s + r.earned, 0);
    const possible = rows.reduce((s, r) => s + r.possible, 0);
    const percent = pct(earned, possible);

    traits.push({
      key,
      group: meta.group ?? 'intellectual',
      label: meta.label,
      blurb: meta.blurb,
      measurable: meta.measurable,
      questionCount: rows.length,
      earned,
      possible,
      percent,
      band: rows.length === 0 ? 'Not seen in this session' : band(percent),
      formScale: rows.length === 0 ? null : formScaleFor(percent),
      evidence: evidenceNote(rows.length, meta.measurable),
    });
  }

  // Overall counts only the traits measured by questions. Folding the inferred
  // ones in would let "did not happen to say anything curious" drag down a
  // number that is supposed to describe performance on the questions.
  const scored = traits.filter(t => t.questionCount > 0);
  const earned = scored.reduce((s, t) => s + t.earned, 0);
  const possible = scored.reduce((s, t) => s + t.possible, 0);

  const ranked = [...scored].sort((a, b) => b.percent - a.percent);

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    overall: { earned, possible, percent: pct(earned, possible) },
    traits,
    strongest: ranked[0]?.label ?? null,
    growthArea: ranked[ranked.length - 1]?.label ?? null,
    responses: results,
    seenQuestionIds: items.map(({ q }) => q.id),
    graderFailed,
    disclaimer:
      'This is a practice reasoning activity, not a standardised or clinical assessment, and not the ' +
      'school referral form. It does not produce an IQ score and cannot predict whether a child will be ' +
      'identified for a gifted programme — that decision weighs several criteria and is never made on one ' +
      'of them. Use this as one piece of evidence when you fill in the rating scale yourself, alongside ' +
      'what you have seen of your child over months. If you have concerns about a child\'s learning or ' +
      'development, speak to their teacher or a qualified professional.',
  };
}

export type { TraitKey };
