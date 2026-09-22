/**
 * The question bank.
 *
 * Each item belongs to a DOMAIN and has a TYPE:
 *   - "mcq"  : one correct option, scored locally and deterministically.
 *   - "open" : free text, graded against a rubric by the language model.
 *
 * `weight` lets a harder item count for more within its domain.
 * `ageBand` lets you serve an age-appropriate subset.
 *
 * Add your own items here, or move this to a database later — the scoring code
 * does not care where the items come from, only about their shape.
 *
 * The `satisfies Question[]` below is doing real work: it will reject an item
 * that has a rubric but calls itself an mcq, an unknown domain key, or a
 * missing answer key, at compile time rather than at scoring time.
 */

import type { DomainKey, DomainMeta, PublicQuestion, Question } from './types.js';

export const DOMAINS: Record<DomainKey, DomainMeta> = {
  verbal_reasoning: {
    label: 'Verbal reasoning',
    blurb: 'Understanding words, relationships between ideas, and explaining thinking in language.',
  },
  quantitative_reasoning: {
    label: 'Quantitative reasoning',
    blurb: 'Working with numbers, quantities, and simple logical arithmetic.',
  },
  pattern_reasoning: {
    label: 'Pattern reasoning',
    blurb: 'Spotting rules in sequences and shapes, then applying them to something new.',
  },
  working_memory: {
    label: 'Working memory',
    blurb: 'Holding information in mind and manipulating it to reach an answer.',
  },
};

export const QUESTIONS = [
  // ---------- Verbal reasoning ----------
  {
    id: 'vr-01',
    domain: 'verbal_reasoning',
    type: 'mcq',
    ageBand: [7, 10],
    weight: 1,
    prompt: 'Bird is to nest as bee is to ___?',
    options: [
      { key: 'a', text: 'Flower' },
      { key: 'b', text: 'Hive' },
      { key: 'c', text: 'Honey' },
      { key: 'd', text: 'Wing' },
    ],
    answerKey: 'b',
  },
  {
    id: 'vr-02',
    domain: 'verbal_reasoning',
    type: 'mcq',
    ageBand: [7, 12],
    weight: 1,
    prompt: 'Which word does NOT belong with the others?',
    options: [
      { key: 'a', text: 'Violin' },
      { key: 'b', text: 'Drum' },
      { key: 'c', text: 'Painting' },
      { key: 'd', text: 'Flute' },
    ],
    answerKey: 'c',
  },
  {
    id: 'vr-03',
    domain: 'verbal_reasoning',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'A friend says: "It rained today, so the picnic was cancelled. It is raining now, so tomorrow\'s picnic will be cancelled too." Do you agree? Explain why or why not.',
    timeLimitSeconds: 180,
    rubric: [
      '3 - Recognises the reasoning is uncertain: today\'s rain does not guarantee rain tomorrow, or that other factors decide a cancellation. States a clear reason.',
      '2 - Reaches a sensible conclusion (agrees or disagrees) with a partly-formed reason, but does not name the gap in the logic.',
      '1 - Answers with an opinion, a guess, or a restatement of the question and no reasoning.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'vr-04',
    domain: 'verbal_reasoning',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt: 'In your own words, what is the difference between a rule and a habit?',
    timeLimitSeconds: 180,
    rubric: [
      '3 - Draws a real distinction: a rule comes from outside and is expected or enforced, a habit is something you do automatically by repetition. May use an example.',
      '2 - Touches one side of the distinction clearly (e.g. explains habits well) but the other only vaguely.',
      '1 - Gives examples of each without explaining how they differ, or restates the words.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },

  // ---------- Quantitative reasoning ----------
  {
    id: 'qr-01',
    domain: 'quantitative_reasoning',
    type: 'mcq',
    ageBand: [7, 10],
    weight: 1,
    prompt: 'Maya has 12 stickers. She gives away a quarter of them. How many does she have left?',
    options: [
      { key: 'a', text: '3' },
      { key: 'b', text: '4' },
      { key: 'c', text: '8' },
      { key: 'd', text: '9' },
    ],
    answerKey: 'd',
  },
  {
    id: 'qr-02',
    domain: 'quantitative_reasoning',
    type: 'mcq',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'A bus leaves every 15 minutes starting at 9:00. Ravi arrives at the stop at 9:38. How long must he wait?',
    options: [
      { key: 'a', text: '2 minutes' },
      { key: 'b', text: '7 minutes' },
      { key: 'c', text: '8 minutes' },
      { key: 'd', text: '12 minutes' },
    ],
    answerKey: 'b',
  },
  {
    id: 'qr-03',
    domain: 'quantitative_reasoning',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'Two pencils cost the same as three erasers. One eraser costs 4 rupees. How much does one pencil cost? Show how you worked it out.',
    timeLimitSeconds: 180,
    rubric: [
      '3 - Correct answer (6) AND a clear method: three erasers cost 12, that equals two pencils, so one pencil is 6.',
      '2 - Correct answer with a thin or partly-stated method, or a fully correct method with a small arithmetic slip.',
      '1 - Wrong answer but shows a relevant first step (e.g. finds that three erasers cost 12).',
      '0 - Blank, off-topic, or a bare wrong number with no working.',
    ],
  },

  // ---------- Pattern reasoning ----------
  {
    id: 'pr-01',
    domain: 'pattern_reasoning',
    type: 'mcq',
    ageBand: [7, 10],
    weight: 1,
    prompt: 'What comes next?    ▲  ▲▲  ▲▲▲  ▲▲▲▲  ___',
    options: [
      { key: 'a', text: '▲▲▲' },
      { key: 'b', text: '▲▲▲▲▲' },
      { key: 'c', text: '▲' },
      { key: 'd', text: '▲▲▲▲▲▲▲' },
    ],
    answerKey: 'b',
  },
  {
    id: 'pr-02',
    domain: 'pattern_reasoning',
    type: 'mcq',
    ageBand: [8, 12],
    weight: 2,
    prompt: 'What number comes next?    2, 6, 12, 20, 30, ___',
    options: [
      { key: 'a', text: '36' },
      { key: 'b', text: '40' },
      { key: 'c', text: '42' },
      { key: 'd', text: '45' },
    ],
    answerKey: 'c',
  },
  {
    id: 'pr-03',
    domain: 'pattern_reasoning',
    type: 'mcq',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'In a code, CAT is written as DBU. Each letter moves forward one place. How would DOG be written?',
    options: [
      { key: 'a', text: 'EPH' },
      { key: 'b', text: 'CNF' },
      { key: 'c', text: 'EOH' },
      { key: 'd', text: 'DPH' },
    ],
    answerKey: 'a',
  },
  {
    id: 'pr-04',
    domain: 'pattern_reasoning',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'Look at this sequence:  1, 1, 2, 3, 5, 8, 13.  What is the rule, and what are the next two numbers?',
    timeLimitSeconds: 180,
    rubric: [
      '3 - States the rule (each number is the sum of the two before it) AND gives 21 and 34.',
      '2 - States the rule correctly but gives one or both next numbers wrong, or gives 21 and 34 with the rule only implied.',
      '1 - Notices the numbers are growing or spots a partial relationship, without the actual rule.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },

  // ---------- Working memory ----------
  {
    id: 'wm-01',
    domain: 'working_memory',
    type: 'mcq',
    ageBand: [7, 12],
    weight: 1,
    prompt:
      'Remember this list: RED, BLUE, GREEN, YELLOW, BLACK. Now, which colour was third?',
    options: [
      { key: 'a', text: 'Blue' },
      { key: 'b', text: 'Green' },
      { key: 'c', text: 'Yellow' },
      { key: 'd', text: 'Black' },
    ],
    answerKey: 'b',
  },
  {
    id: 'wm-02',
    domain: 'working_memory',
    type: 'mcq',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'Take the numbers 4, 7, 2, 9. Put them in order from largest to smallest. What is the third number in your new order?',
    options: [
      { key: 'a', text: '2' },
      { key: 'b', text: '4' },
      { key: 'c', text: '7' },
      { key: 'd', text: '9' },
    ],
    answerKey: 'b',
  },
  {
    id: 'wm-03',
    domain: 'working_memory',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'Follow these steps in your head: start at 10, add 5, take away 3, then double it. What number do you end with, and what was the number after each step?',
    timeLimitSeconds: 150,
    rubric: [
      '3 - Final answer 24 AND the intermediate steps given correctly (15, then 12, then 24).',
      '2 - Final answer 24 with steps missing or partly wrong, or steps correct with a slip in the final doubling.',
      '1 - One step carried out correctly, then the chain breaks down.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
] satisfies Question[];

/** Highest score a single open-ended item can earn from the grader. */
export const OPEN_MAX_POINTS = 3;

export function getQuestions({ age }: { age?: number } = {}): Question[] {
  if (!age) return QUESTIONS;
  return QUESTIONS.filter((q) => age >= q.ageBand[0] && age <= q.ageBand[1]);
}

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

/**
 * What the app is allowed to see. Never ship `answerKey` or `rubric` to the
 * client — anything in the app bundle can be read by a determined user.
 */
export function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    domain: q.domain,
    type: q.type,
    prompt: q.prompt,
    options: q.type === 'mcq' ? q.options : null,
    timeLimitSeconds: q.timeLimitSeconds ?? null,
  };
}
