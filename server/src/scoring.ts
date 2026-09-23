/**
 * Turning raw answers into a report, organised by the eight Intellectual
 * Ability traits.
 *
 * Scoring scale
 * -------------
 * Every item is worth `weight * OPEN_MAX_POINTS` points.
 *   - An MCQ earns all of them or none: it is right or it is not.
 *   - An open item earns `weight * band`, where band is the 0-3 rubric score.
 *   - A challenge earns full marks for reaching for the harder task, and a
 *     third for taking the easy one. Choosing easy is real evidence about
 *     challenge-seeking in that moment, but one choice is thin, which is why it
 *     is not scored as zero.
 *
 * What this deliberately does not produce
 * ---------------------------------------
 * No IQ number, no percentile, no prediction about gifted identification. The
 * Harmony process weighs a parent rating alongside other criteria and explicitly
 * does not decide on any single one. A practice activity cannot tell you what a
 * committee will conclude, and implying otherwise would be the most damaging
 * thing this app could do.
 *
 * Traits with no evidence are reported as "not seen", never as zero.
 */

import { OPEN_MAX_POINTS, questionById } from './questions.js';
import { TRAITS, TRAIT_ORDER, formScaleFor } from './traits.js';
import { gradeOpenAnswers } from './grader.js';
import type {
  Grade,
  GradeRequestItem,
  Question,
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
  const items: Array<{ q: Question; answer: string; elapsedSeconds: number | null }> = [];

  for (const r of responses) {
    const q = questionById(r.questionId);
    if (!q) continue; // ignore unknown ids rather than failing the whole run
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
      const chosen = (answer ?? '').trim().toLowerCase();
      const correct = chosen === q.answerKey;
      results.push({
        questionId: q.id,
        trait: q.trait,
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
    } else if (q.type === 'challenge') {
      const chosen = (answer ?? '').trim().toLowerCase();
      const choseHarder = chosen === q.hardKey.toLowerCase();
      results.push({
        questionId: q.id,
        trait: q.trait,
        type: 'challenge',
        prompt: q.prompt,
        answer,
        choseHarder,
        // Not right or wrong — a preference. Full marks for reaching for the
        // harder task, a third for the easier one.
        earned: choseHarder ? possible : Math.round(possible / 3),
        possible,
        elapsedSeconds,
        note: choseHarder
          ? 'Offered an easy or a hard puzzle, chose the hard one.'
          : 'Offered an easy or a hard puzzle, chose the easy one.',
      });
    } else if ((answer ?? '').trim() === '') {
      // Skipped, not wrong. Scoring a blank as zero would pull the trait row
      // down to "Poor" on the parent's rating scale, which would say the child
      // reasons badly when in fact nothing was asked of them — the microphone
      // failed, or they moved on. Missing evidence is reported as missing.
      results.push({
        questionId: q.id,
        trait: q.trait,
        type: 'open',
        prompt: q.prompt,
        answer,
        earned: 0,
        possible: 0,
        elapsedSeconds,
        skipped: true,
        note: 'Skipped — left out of the score rather than counted as wrong.',
      });
    } else {
      openItems.push({
        id: q.id,
        trait: q.trait,
        prompt: q.prompt,
        rubric: q.rubric,
        answer,
      });
      results.push({
        questionId: q.id,
        trait: q.trait,
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
  let grades: Grade[] = [];

  if (openItems.length > 0) {
    try {
      grades = await gradeOpenAnswers(openItems);
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
      console.error(`\n  x GRADING FAILED — ${openItems.length} written answer(s) left ungraded`);
      console.error(`    ${graderFailed}\n`);
      for (const row of results) {
        if (row.type === 'open' && !row.skipped) {
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

    const hasDedicatedItems = results.some((r) => r.trait === key);
    if (meta.measurable === 'inferred' && !hasDedicatedItems) {
      // Originality and curiosity are not asked for directly — they are read
      // out of how the child answered. Each flagged answer is one point of
      // evidence, out of however many open answers there were to observe.
      const flagged = grades.filter((g) =>
        key === 'original_methods' ? g.originalMethod : g.showedCuriosity
      ).length;
      const observable = grades.length;
      const percent = pct(flagged, observable);

      traits.push({
        key,
        label: meta.label,
        blurb: meta.blurb,
        measurable: meta.measurable,
        questionCount: flagged,
        earned: flagged,
        possible: observable,
        percent,
        band:
          observable === 0
            ? 'Not seen in this session'
            : flagged === 0
              ? 'Not shown in these answers'
              : `Shown in ${flagged} of ${observable} answers`,
        formScale: null,
        evidence: evidenceNote(observable, meta.measurable),
      });
      continue;
    }

    // A skipped or ungraded row carries no evidence about this trait, so it is
    // left out of both the score and the count of how much was seen. Counting
    // it would make a thin session look better evidenced than it was.
    const rows = results.filter((r) => r.trait === key && !r.skipped && !r.ungraded);
    const earned = rows.reduce((s, r) => s + r.earned, 0);
    const possible = rows.reduce((s, r) => s + r.possible, 0);
    const percent = pct(earned, possible);

    traits.push({
      key,
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
  const scored = traits.filter((t) => t.questionCount > 0 && (t.measurable !== 'inferred' || results.some(r => r.trait === t.key)));
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
