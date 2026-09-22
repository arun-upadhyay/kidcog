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
  // =========================================================================
  // EARLY YEARS (ages 4-7)
  //
  // Written for children who cannot read. The `visual` carries the question,
  // `spoken` is what the read-aloud voice says, and `prompt` is the short text
  // a grown-up can see. Options lead with a symbol so a child can answer by
  // recognising a picture rather than reading a word.
  //
  // Open items are answered by speaking, so rubrics judge a spoken sentence
  // from a small child: a correct idea in four words is a full-marks answer.
  // =========================================================================

  {
    id: 'ey-vr-01',
    domain: 'verbal_reasoning',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'Which one is not something you can eat?',
    spoken: 'Three of these are things you can eat. Which one is not?',
    visual: '🍎   🍌   🍐   🚗',
    options: [
      { key: 'a', text: 'Apple', symbol: '🍎' },
      { key: 'b', text: 'Banana', symbol: '🍌' },
      { key: 'c', text: 'Pear', symbol: '🍐' },
      { key: 'd', text: 'Car', symbol: '🚗' },
    ],
    answerKey: 'd',
  },
  {
    id: 'ey-vr-02',
    domain: 'verbal_reasoning',
    type: 'open',
    ageBand: [4, 7],
    weight: 2,
    prompt: 'Why do we wear a coat when it is cold?',
    spoken: 'Here is a thinking question. Why do we wear a coat when it is cold outside?',
    visual: '🧥  ❄️',
    timeLimitSeconds: 120,
    rubric: [
      '3 - Links the coat to staying warm or keeping the cold out. Any wording counts: "so you stay warm", "it keeps the cold off you".',
      '2 - Says it stops you being cold without saying the coat does the keeping-warm, or gives a related sensible reason such as not getting ill.',
      '1 - Names the coat or the cold without connecting them, e.g. "because it is cold" or "my coat is red".',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'ey-qr-01',
    domain: 'quantitative_reasoning',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'How many stars are there?',
    spoken: 'Count the stars. How many are there?',
    visual: '⭐ ⭐ ⭐ ⭐',
    options: [
      { key: 'a', text: 'Three', symbol: '3' },
      { key: 'b', text: 'Four', symbol: '4' },
      { key: 'c', text: 'Five', symbol: '5' },
    ],
    answerKey: 'b',
  },
  {
    id: 'ey-qr-02',
    domain: 'quantitative_reasoning',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'Which row has more?',
    spoken: 'Look at the two rows of fish. Which row has more fish, the top row or the bottom row?',
    visual: '🐟 🐟 🐟 🐟 🐟\n\n🐟 🐟 🐟',
    options: [
      { key: 'a', text: 'The top row', symbol: '⬆️' },
      { key: 'b', text: 'The bottom row', symbol: '⬇️' },
      { key: 'c', text: 'They are the same', symbol: '🟰' },
    ],
    answerKey: 'a',
  },
  {
    id: 'ey-qr-03',
    domain: 'quantitative_reasoning',
    type: 'open',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Three birds sit on a branch. One flies away. How many are left, and how do you know?',
    spoken:
      'Three birds are sitting on a branch. One of them flies away. How many birds are left? Tell me how you worked it out.',
    visual: '🐦 🐦 🐦  →  🕊️',
    timeLimitSeconds: 120,
    rubric: [
      '3 - Says two AND gives any reasoning: counted back, took one away, counted what was left. "Two, because one went" is full marks.',
      '2 - Says two with no reasoning at all, or reasons correctly but says the wrong number.',
      '1 - Counts or names numbers without reaching an answer.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'ey-pr-01',
    domain: 'pattern_reasoning',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'What comes next?',
    spoken: 'Look at the pattern. Red, blue, red, blue, red. What comes next?',
    visual: '🔴 🔵 🔴 🔵 🔴 ❓',
    options: [
      { key: 'a', text: 'Blue', symbol: '🔵' },
      { key: 'b', text: 'Red', symbol: '🔴' },
      { key: 'c', text: 'Yellow', symbol: '🟡' },
    ],
    answerKey: 'a',
  },
  {
    id: 'ey-pr-02',
    domain: 'pattern_reasoning',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'What comes next?',
    spoken: 'Look at the shapes. Star, moon, star, moon, star. What comes next?',
    visual: '⭐ 🌙 ⭐ 🌙 ⭐ ❓',
    options: [
      { key: 'a', text: 'Star', symbol: '⭐' },
      { key: 'b', text: 'Moon', symbol: '🌙' },
      { key: 'c', text: 'Sun', symbol: '☀️' },
    ],
    answerKey: 'b',
  },
  {
    id: 'ey-pr-03',
    domain: 'pattern_reasoning',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Which one is getting bigger in the right order?',
    spoken: 'The circles are getting bigger. Which circle should come next, the small one or the big one?',
    visual: '· ∙ ●  ❓',
    options: [
      { key: 'a', text: 'A bigger circle', symbol: '⬤' },
      { key: 'b', text: 'A tiny circle', symbol: '·' },
    ],
    answerKey: 'a',
  },
  {
    id: 'ey-wm-01',
    domain: 'working_memory',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'Which animal came first?',
    spoken: 'Listen carefully. Cat. Dog. Bird. Which animal did I say first?',
    visual: '🐱 → 🐶 → 🐦',
    options: [
      { key: 'a', text: 'Cat', symbol: '🐱' },
      { key: 'b', text: 'Dog', symbol: '🐶' },
      { key: 'c', text: 'Bird', symbol: '🐦' },
    ],
    answerKey: 'a',
  },
  {
    id: 'ey-wm-02',
    domain: 'working_memory',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Which one was in the middle?',
    spoken: 'Listen carefully. Apple. Hat. Boat. Which one did I say in the middle?',
    visual: '🍎 → 🎩 → ⛵',
    options: [
      { key: 'a', text: 'Apple', symbol: '🍎' },
      { key: 'b', text: 'Hat', symbol: '🎩' },
      { key: 'c', text: 'Boat', symbol: '⛵' },
    ],
    answerKey: 'b',
  },
] satisfies Question[];

/** Highest score a single open-ended item can earn from the grader. */
export const OPEN_MAX_POINTS = 3;

/**
 * Questions for an age, capped by the profile.
 *
 * The cap is not cosmetic: an eight-question limit for a four-year-old is the
 * difference between finishing and giving up halfway, and a session abandoned
 * in the middle tells you nothing about the child.
 */
export function getQuestions({ age, limit }: { age?: number; limit?: number } = {}): Question[] {
  const matching =
    age === undefined
      ? QUESTIONS
      : QUESTIONS.filter((q) => age >= q.ageBand[0] && age <= q.ageBand[1]);

  if (limit === undefined || matching.length <= limit) return matching;

  // Trim from the end rather than sampling, so a session is reproducible and
  // the domain mix stays in the order the bank was written in.
  return matching.slice(0, limit);
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
    visual: q.visual ?? null,
    spoken: q.spoken ?? null,
  };
}
