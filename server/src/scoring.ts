/**
 * Turning raw answers into a report.
 *
 * Scoring scale
 * -------------
 * Every item is worth `weight * OPEN_MAX_POINTS` points.
 *   - An MCQ earns all of them or none: it is right or it is not.
 *   - An open item earns `weight * band`, where band is the 0-3 rubric score.
 * Putting both on the same scale is what lets us mix them inside one domain.
 *
 * What this deliberately does NOT produce
 * ---------------------------------------
 * No IQ number, no percentile, no age equivalent. Those require a test
 * standardised on a large representative sample of children, with published
 * reliability and validity evidence. This is a practice instrument, so it
 * reports what the child did on these questions and nothing beyond that.
 */

import { DOMAINS, OPEN_MAX_POINTS, questionById } from './questions.js';
import { gradeOpenAnswers } from './grader.js';
import type {
  DomainKey,
  DomainReport,
  GradeRequestItem,
  Question,
  Report,
  ResponseInput,
  ScoredResponse,
} from './types.js';

function pct(earned: number, possible: number): number {
  if (possible === 0) return 0;
  return Math.round((earned / possible) * 100);
}

/** A qualitative label — describes performance on this test, not the child. */
function band(percent: number): string {
  if (percent >= 85) return 'These questions were handled comfortably';
  if (percent >= 65) return 'Mostly solid, with a few sticking points';
  if (percent >= 40) return 'Some worked, some were challenging';
  return 'This area was challenging in this session';
}

export async function scoreSubmission(responses: ResponseInput[]): Promise<Report> {
  const items: Array<{ q: Question; answer: string; elapsedSeconds: number | null }> = [];

  for (const r of responses) {
    const q = questionById(r.questionId);
    if (!q) continue; // ignore unknown ids rather than failing the whole run
    items.push({ q, answer: r.answer, elapsedSeconds: r.elapsedSeconds ?? null });
  }

  // --- Multiple choice: scored here, locally, deterministically. ---
  const results: ScoredResponse[] = [];
  const openItems: GradeRequestItem[] = [];

  for (const { q, answer, elapsedSeconds } of items) {
    const possible = q.weight * OPEN_MAX_POINTS;

    // The discriminated union means TypeScript knows `q.answerKey` exists in
    // this branch and `q.rubric` exists in the other. No casts needed.
    if (q.type === 'mcq') {
      const chosen = (answer ?? '').trim().toLowerCase();
      const correct = chosen === q.answerKey;
      results.push({
        questionId: q.id,
        domain: q.domain,
        type: 'mcq',
        prompt: q.prompt,
        answer,
        correct,
        earned: correct ? possible : 0,
        possible,
        elapsedSeconds,
        note: correct
          ? 'Correct.'
          : `Answered ${chosen || '(blank)'}; the correct option was ${q.answerKey}.`,
      });
    } else {
      openItems.push({
        id: q.id,
        domain: q.domain,
        prompt: q.prompt,
        rubric: q.rubric,
        answer,
      });
      results.push({
        questionId: q.id,
        domain: q.domain,
        type: 'open',
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
  if (openItems.length > 0) {
    try {
      const grades = await gradeOpenAnswers(openItems);
      const byId = new Map(grades.map((g) => [g.id, g]));
      for (const row of results) {
        if (row.type !== 'open') continue;
        const g = byId.get(row.questionId);
        const q = questionById(row.questionId);
        if (g && q) {
          row.band = g.points;
          row.earned = g.points * q.weight;
          row.note = g.note;
        }
      }
    } catch (err) {
      graderFailed = err instanceof Error ? err.message : String(err);
      // Leave open items ungraded rather than guessing a score. The report
      // says so explicitly so nobody reads a partial result as a full one.
      for (const row of results) {
        if (row.type === 'open') {
          row.note = 'Could not be graded automatically — needs a human read.';
          row.ungraded = true;
          row.possible = 0; // keep it out of the totals rather than counting it wrong
        }
      }
    }
  }

  // --- Aggregate by domain. ---
  const domains: DomainReport[] = (Object.entries(DOMAINS) as Array<[DomainKey, { label: string; blurb: string }]>)
    .map(([key, meta]) => {
      const rows = results.filter((r) => r.domain === key);
      const earned = rows.reduce((s, r) => s + r.earned, 0);
      const possible = rows.reduce((s, r) => s + r.possible, 0);
      return {
        key,
        label: meta.label,
        blurb: meta.blurb,
        questionCount: rows.length,
        earned,
        possible,
        percent: pct(earned, possible),
        band: band(pct(earned, possible)),
      };
    })
    .filter((d) => d.questionCount > 0);

  const earned = domains.reduce((s, d) => s + d.earned, 0);
  const possible = domains.reduce((s, d) => s + d.possible, 0);

  const sorted = [...domains].sort((a, b) => b.percent - a.percent);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    overall: { earned, possible, percent: pct(earned, possible) },
    domains,
    strongest: sorted[0]?.label ?? null,
    growthArea: sorted[sorted.length - 1]?.label ?? null,
    responses: results,
    graderFailed,
    disclaimer:
      'This is a practice reasoning activity, not a standardised or clinical assessment. ' +
      "It does not produce an IQ score and a single session cannot measure a child's ability. " +
      "If you have concerns about a child's learning or development, speak to their teacher or a qualified professional.",
  };
}
