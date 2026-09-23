/**
 * The question bank.
 *
 * Organised by the eight Intellectual Ability traits from the Harmony GATE
 * parent rating scale, so a session produces evidence per row of that form
 * rather than one undifferentiated score.
 *
 * Every item is original. None of it reproduces a real instrument: those items
 * are copyrighted and kept secure, and a child drilled on them produces a score
 * that measures the drilling rather than the child.
 *
 * Depth matters here more than it used to. Reassessment serves only questions a
 * child has not already seen, so a trait with two items supports one retake and
 * then runs dry. Several per trait per age band is the working minimum, and
 * `npm run generate` exists to deepen it.
 *
 * The `satisfies Question[]` at the end is load-bearing: it rejects an item with
 * a rubric that calls itself an mcq, an unknown trait, or a missing answer key,
 * at compile time rather than in front of a child.
 */

import type { PublicQuestion, Question, TraitKey } from './types.js';
import { TRAITS, TRAIT_ORDER } from './traits.js';
import { one, MISSING, figureProblems } from './figures.js';
import { PROFILES } from './ageProfiles.js';

export const QUESTIONS = [
  {"id": "category-cur-1", "trait": "curiosity", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "You find a seed you have never seen. What would you like to find out about it?", "rubric": ["3 - Asks a relevant question about the seed and suggests how to explore it. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-cur-2", "trait": "curiosity", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "A toy car rolls farther on one floor than another. What would you ask or try to find out why?", "rubric": ["3 - Asks about a relevant difference and suggests comparing surfaces or testing the car. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-cur-3", "trait": "curiosity", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "You see a bird carrying little sticks. What do you wonder about?", "rubric": ["3 - Asks a relevant question about the bird and suggests an observation to learn more. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-cur-4", "trait": "curiosity", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "An ice cube is getting smaller. What question could you ask, and how could you find out?", "rubric": ["3 - Asks a relevant question about melting and suggests a useful observation or comparison. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-cur-5", "trait": "curiosity", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "You find a box that makes a sound when you move it. What would you like to know, and how could you investigate without opening it?", "rubric": ["3 - Asks about the contents and suggests a relevant safe investigation. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-cur-6", "trait": "curiosity", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "One plant bends toward a window. What do you wonder, and what could you try to learn more?", "rubric": ["3 - Asks a relevant question about the plant and suggests observing or changing its light. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-ori-1", "trait": "original_methods", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "Your toy needs to cross a pretend river. You have paper and blocks. What could you build? Can you think of a different way?", "rubric": ["3 - Offers two distinct workable crossing ideas, or one workable idea adapted thoughtfully. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-ori-2", "trait": "original_methods", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "You want to sort your toys without putting all the same colors together. What other ways could you sort them?", "rubric": ["3 - Offers two different sensible sorting rules and explains or demonstrates one. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-ori-3", "trait": "original_methods", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "You have no paintbrush. What could you use to make a picture? How would you use it?", "rubric": ["3 - Proposes a workable alternative tool and explains how it makes marks. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-ori-4", "trait": "original_methods", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "You want to carry several blocks but have no bag. How could you do it? Is there another way?", "rubric": ["3 - Offers two workable carrying solutions, or explains a useful adaptation of one. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-ori-5", "trait": "original_methods", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "Make up a new game using a ball and two cups. How do you play?", "rubric": ["3 - Describes a playable game with a clear action and goal or rule. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  {"id": "category-ori-6", "trait": "original_methods", "format": "explanation", "type": "open", "ageBand": [4, 12], "weight": 1, "prompt": "A little toy keeps falling over. How could you help it stand without holding it?", "rubric": ["3 - Proposes a workable support or balance solution and explains how it helps. Accept simple words, gestures described by a parent, and age-appropriate ideas.", "2 - Gives a relevant question or workable idea with a partial explanation.", "1 - Gives a related response but no clear question or workable idea.", "0 - Off topic or not interpretable. Do not award points for length or sophisticated vocabulary."]},
  // =========================================================================
  // EARLY YEARS (4-7)
  // =========================================================================

  // ---- Comprehends abstract ideas and concepts ----
  {
    id: 'e-abs-01',
    trait: 'abstract_concepts',
    format: 'classification',
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
    id: 'e-abs-02',
    trait: 'abstract_concepts',
    format: 'classification',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Which one is not a way to travel?',
    spoken: 'Three of these are ways to travel somewhere. Which one is not?',
    visual: '🚌   ✈️   🚲   🪑',
    options: [
      { key: 'a', text: 'Bus', symbol: '🚌' },
      { key: 'b', text: 'Plane', symbol: '✈️' },
      { key: 'c', text: 'Bicycle', symbol: '🚲' },
      { key: 'd', text: 'Chair', symbol: '🪑' },
    ],
    answerKey: 'd',
  },
  {
    id: 'e-abs-03',
    trait: 'abstract_concepts',
    format: 'explanation',
    type: 'open',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'What does it mean when someone is being kind?',
    spoken: 'Here is a thinking question. What does it mean when someone is being kind?',
    visual: '💛',
    timeLimitSeconds: 120,
    rubric: [
      '3 - Describes kindness as a way of treating others: helping, sharing, caring how someone feels. Any wording counts.',
      '2 - Gives a clear example of a kind act without saying what makes it kind.',
      '1 - Names something loosely related, or repeats the word.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },

  // ---- Considers problems outside their own experience ----
  {
    id: 'e-bey-01',
    trait: 'beyond_experience',
    format: 'explanation',
    type: 'open',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Imagine a place where it snows every single day. What would you need there?',
    spoken:
      'Imagine somewhere it snows every single day, all year long. What would you need to live in a place like that?',
    visual: '❄️ 🏠 ❄️',
    timeLimitSeconds: 150,
    rubric: [
      '3 - Names something suited to constant snow AND connects it to the snow: warm clothes to not freeze, a strong roof, boots, heating.',
      '2 - Names something sensible for cold without saying why, or reasons well about a slightly different situation.',
      '1 - Talks about snow or cold without naming what would be needed.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'e-bey-02',
    trait: 'beyond_experience',
    format: 'explanation',
    type: 'open',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'If people could fly, what would be different about houses?',
    spoken:
      'Here is a pretend question. If everybody could fly, what do you think would be different about the houses we live in?',
    visual: '🦅  🏠',
    timeLimitSeconds: 150,
    rubric: [
      '3 - Follows the idea through to a real consequence: doors or windows higher up, no need for stairs, landing places on roofs.',
      '2 - Offers a change that is plausible but only loosely connected to flying.',
      '1 - Talks about flying or houses without connecting the two.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },

  // ---- Makes quick and valid generalizations ----
  {
    id: 'e-gen-01',
    trait: 'generalization',
    format: 'figure_series',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'What comes next?',
    spoken: 'Look at the shapes. Circle, square, circle, square, circle. What comes next?',
    figure: {
      kind: 'series',
      columns: 6,
      cells: [
        one({ kind: 'circle', fill: 'solid', tone: 'primary' }),
        one({ kind: 'square', fill: 'solid', tone: 'cool' }),
        one({ kind: 'circle', fill: 'solid', tone: 'primary' }),
        one({ kind: 'square', fill: 'solid', tone: 'cool' }),
        one({ kind: 'circle', fill: 'solid', tone: 'primary' }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'A square', figure: one({ kind: 'square', fill: 'solid', tone: 'cool' }) },
      { key: 'b', text: 'A circle', figure: one({ kind: 'circle', fill: 'solid', tone: 'primary' }) },
      { key: 'c', text: 'A triangle', figure: one({ kind: 'triangle', fill: 'solid', tone: 'go' }) },
    ],
    answerKey: 'a',
  },
  {
    id: 'e-gen-02',
    trait: 'generalization',
    format: 'figure_series',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'The circles are growing. Which one comes next?',
    spoken: 'Look at the circles. They get bigger each time. Which circle comes next?',
    figure: {
      kind: 'series',
      columns: 4,
      cells: [
        one({ kind: 'circle', fill: 'solid', tone: 'happy', scale: 0.4 }),
        one({ kind: 'circle', fill: 'solid', tone: 'happy', scale: 0.65 }),
        one({ kind: 'circle', fill: 'solid', tone: 'happy', scale: 0.9 }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'A tiny circle', figure: one({ kind: 'circle', fill: 'solid', tone: 'happy', scale: 0.3 }) },
      { key: 'b', text: 'A bigger circle', figure: one({ kind: 'circle', fill: 'solid', tone: 'happy', scale: 1.15 }) },
      { key: 'c', text: 'The same size', figure: one({ kind: 'circle', fill: 'solid', tone: 'happy', scale: 0.9 }) },
    ],
    answerKey: 'b',
  },
  {
    id: 'e-gen-03',
    trait: 'generalization',
    format: 'figure_matrix',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Which shape belongs in the empty box?',
    spoken:
      'Look at the four boxes. The top two go together, and the bottom two should go together in the same way. Which shape belongs in the empty box?',
    figure: {
      kind: 'matrix',
      columns: 2,
      cells: [
        one({ kind: 'circle', fill: 'solid', tone: 'primary' }),
        one({ kind: 'circle', fill: 'outline', tone: 'primary' }),
        one({ kind: 'square', fill: 'solid', tone: 'cool' }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'A filled square', figure: one({ kind: 'square', fill: 'solid', tone: 'cool' }) },
      { key: 'b', text: 'An empty square', figure: one({ kind: 'square', fill: 'outline', tone: 'cool' }) },
      { key: 'c', text: 'An empty circle', figure: one({ kind: 'circle', fill: 'outline', tone: 'primary' }) },
    ],
    answerKey: 'b',
  },
  {
    id: 'e-gen-04',
    trait: 'generalization',
    format: 'number_series',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'What number comes next?   2, 4, 6, ___',
    spoken: 'Listen to the numbers. Two, four, six. What number comes next?',
    visual: '2   4   6   ❓',
    options: [
      { key: 'a', text: 'Seven', symbol: '7' },
      { key: 'b', text: 'Eight', symbol: '8' },
      { key: 'c', text: 'Ten', symbol: '10' },
    ],
    answerKey: 'b',
  },

  // ---- Sees cause and effect ----
  {
    id: 'e-cau-01',
    trait: 'cause_effect',
    format: 'explanation',
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
      '1 - Names the coat or the cold without connecting them.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'e-cau-02',
    trait: 'cause_effect',
    format: 'prediction',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'A plant was left with no water for a long time. What most likely happened?',
    spoken:
      'A plant sat by the window and nobody watered it for a very long time. What do you think most likely happened to it?',
    visual: '🪴  ☀️  ❓',
    options: [
      { key: 'a', text: 'It grew taller', symbol: '🌳' },
      { key: 'b', text: 'It wilted and died', symbol: '🥀' },
      { key: 'c', text: 'It turned into a flower', symbol: '🌸' },
    ],
    answerKey: 'b',
  },
  {
    id: 'e-cau-03',
    trait: 'cause_effect',
    format: 'explanation',
    type: 'open',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'What would happen if you left an ice cream on a sunny doorstep? Why?',
    spoken:
      'Imagine you put an ice cream down on a doorstep on a very sunny day, and went inside. What would happen to it? Tell me why.',
    visual: '🍦  ☀️',
    timeLimitSeconds: 120,
    rubric: [
      '3 - Says it melts AND gives the cause: the sun, the heat, it being warm.',
      '2 - Says it melts with no reason, or gives a sensible related consequence with a reason.',
      '1 - Mentions the sun or the ice cream without saying what happens.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },

  // ---- Is keenly observant ----
  {
    id: 'e-obs-01',
    trait: 'observant',
    format: 'figure_classification',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'Which shape does not belong?',
    spoken:
      'Look at the four shapes. Three are the same kind of shape and one is different. Which one does not belong?',
    figure: {
      kind: 'group',
      columns: 4,
      cells: [
        one({ kind: 'triangle', fill: 'solid', tone: 'go' }),
        one({ kind: 'triangle', fill: 'solid', tone: 'happy' }),
        one({ kind: 'square', fill: 'solid', tone: 'cool' }),
        one({ kind: 'triangle', fill: 'solid', tone: 'primary' }),
      ],
    },
    options: [
      { key: 'a', text: 'The first one', figure: one({ kind: 'triangle', fill: 'solid', tone: 'go' }) },
      { key: 'b', text: 'The second one', figure: one({ kind: 'triangle', fill: 'solid', tone: 'happy' }) },
      { key: 'c', text: 'The third one', figure: one({ kind: 'square', fill: 'solid', tone: 'cool' }) },
      { key: 'd', text: 'The fourth one', figure: one({ kind: 'triangle', fill: 'solid', tone: 'primary' }) },
    ],
    answerKey: 'c',
  },
  {
    id: 'e-obs-02',
    trait: 'observant',
    format: 'spot_the_difference',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Three stars are the same. Which one is turned a different way?',
    spoken:
      'Look carefully at the four stars. Three of them are exactly the same. One of them is turned a different way. Which one?',
    figure: {
      kind: 'group',
      columns: 4,
      cells: [
        one({ kind: 'star', fill: 'solid', tone: 'happy' }),
        one({ kind: 'star', fill: 'solid', tone: 'happy' }),
        one({ kind: 'star', fill: 'solid', tone: 'happy', rotate: 36 }),
        one({ kind: 'star', fill: 'solid', tone: 'happy' }),
      ],
    },
    options: [
      { key: 'a', text: 'The first one', symbol: '1️⃣' },
      { key: 'b', text: 'The second one', symbol: '2️⃣' },
      { key: 'c', text: 'The third one', symbol: '3️⃣' },
      { key: 'd', text: 'The fourth one', symbol: '4️⃣' },
    ],
    answerKey: 'c',
  },

  // ---- Chooses and enjoys challenging tasks (measured by the choice) ----
  {
    id: 'e-cha-01',
    trait: 'challenge_seeking',
    format: 'choice',
    type: 'challenge',
    ageBand: [4, 7],
    weight: 2,
    prompt: 'You can pick your next puzzle. Which one would you like?',
    spoken:
      'Now you get to choose. Would you like an easy puzzle, or a tricky one? There is no wrong answer — pick whichever you want.',
    visual: '🙂   or   🤔',
    options: [
      { key: 'easy', text: 'An easy one', symbol: '🙂' },
      { key: 'hard', text: 'A tricky one', symbol: '🤔' },
    ],
    hardKey: 'hard',
    followUp: { easy: 'e-cha-easy', hard: 'e-cha-hard' },
  },
  {
    id: 'e-cha-easy',
    trait: 'generalization',
    format: 'figure_series',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    hidden: true,
    prompt: 'What comes next?',
    spoken: 'Here is your easy puzzle. Star, moon, star, moon, star. What comes next?',
    visual: '⭐ 🌙 ⭐ 🌙 ⭐ ❓',
    options: [
      { key: 'a', text: 'Star', symbol: '⭐' },
      { key: 'b', text: 'Moon', symbol: '🌙' },
      { key: 'c', text: 'Sun', symbol: '☀️' },
    ],
    answerKey: 'b',
  },
  {
    id: 'e-cha-hard',
    trait: 'generalization',
    format: 'figure_matrix',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 2,
    hidden: true,
    prompt: 'Which shape belongs in the empty box?',
    spoken:
      'Here is your tricky puzzle. Each row has a filled shape and then the same shape empty. Which shape belongs in the empty box?',
    figure: {
      kind: 'matrix',
      columns: 2,
      cells: [
        one({ kind: 'star', fill: 'solid', tone: 'happy' }),
        one({ kind: 'star', fill: 'outline', tone: 'happy' }),
        one({ kind: 'hexagon', fill: 'solid', tone: 'go' }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'A filled hexagon', figure: one({ kind: 'hexagon', fill: 'solid', tone: 'go' }) },
      { key: 'b', text: 'An empty hexagon', figure: one({ kind: 'hexagon', fill: 'outline', tone: 'go' }) },
      { key: 'c', text: 'An empty star', figure: one({ kind: 'star', fill: 'outline', tone: 'happy' }) },
    ],
    answerKey: 'b',
  },

  // =========================================================================
  // EARLY YEARS — SECOND ROUND
  //
  // These exist so a reassessment has somewhere to go. The set above is one
  // session's worth; without these, a second round repeats questions, which
  // measures what the child remembers rather than how they think.
  //
  // They are deliberately banded to include four-year-olds: most of the set
  // above starts at five, which left a four-year-old with a single item in
  // several traits and nothing at all in one.
  // =========================================================================

  // ---- Comprehends abstract ideas and concepts ----
  {
    id: 'e-abs-04',
    trait: 'abstract_concepts',
    format: 'classification',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'Which one is not an animal?',
    spoken: 'Three of these are animals. Which one is not?',
    visual: '🐶   🐟   🌳   🐝',
    options: [
      { key: 'a', text: 'Dog', symbol: '🐶' },
      { key: 'b', text: 'Fish', symbol: '🐟' },
      { key: 'c', text: 'Tree', symbol: '🌳' },
      { key: 'd', text: 'Bee', symbol: '🐝' },
    ],
    answerKey: 'c',
  },
  {
    id: 'e-abs-05',
    trait: 'abstract_concepts',
    format: 'classification',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    // "Things you use to draw" is a category held together by what the objects
    // are FOR, not by how they look — which is the abstraction being asked for.
    prompt: 'Three of these are for drawing. Which one is not?',
    spoken: 'Three of these are things you draw with. Which one is not for drawing?',
    visual: '✏️   🖍️   🖌️   🥄',
    options: [
      { key: 'a', text: 'Pencil', symbol: '✏️' },
      { key: 'b', text: 'Crayon', symbol: '🖍️' },
      { key: 'c', text: 'Paintbrush', symbol: '🖌️' },
      { key: 'd', text: 'Spoon', symbol: '🥄' },
    ],
    answerKey: 'd',
  },

  // ---- Considers problems outside their own experience ----
  {
    id: 'e-bey-03',
    trait: 'beyond_experience',
    format: 'prediction',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    // Multiple choice rather than open, so a four-year-old who cannot yet
    // explain an idea out loud can still show they worked it out.
    prompt: 'On the moon there is no air moving. What would a kite do there?',
    spoken:
      'Here is a pretend question. On the moon, there is no wind at all — no air moving. If you took a kite to the moon, what would it do?',
    visual: '🌕   🪁',
    options: [
      { key: 'a', text: 'Fly very high', symbol: '⬆️' },
      { key: 'b', text: 'Fall down', symbol: '⬇️' },
      { key: 'c', text: 'Spin in circles', symbol: '🌀' },
    ],
    answerKey: 'b',
  },
  {
    id: 'e-bey-04',
    trait: 'beyond_experience',
    format: 'explanation',
    type: 'open',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'What would be hard about living somewhere with no water at all?',
    spoken:
      'Imagine a place with no water anywhere — no taps, no rain, no rivers. What do you think would be hard about living there?',
    visual: '🏜️',
    timeLimitSeconds: 150,
    rubric: [
      '3 - Names something water is needed for AND ties the difficulty to its absence: nothing to drink, no way to wash, plants would die.',
      '2 - Names a sensible consequence without saying why water matters to it.',
      '1 - Talks about water or dryness without naming a difficulty.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },

  {
    id: 'e-bey-05',
    trait: 'beyond_experience',
    format: 'prediction',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'Somewhere it is dark all day and all night. What would people need most?',
    spoken:
      'Imagine a place where the sun never comes up, so it is dark all day and all night. What do you think people would need most there?',
    visual: '🌑   🏘️',
    options: [
      { key: 'a', text: 'Lots of lights', symbol: '💡' },
      { key: 'b', text: 'Sunglasses', symbol: '🕶️' },
      { key: 'c', text: 'Umbrellas', symbol: '☂️' },
    ],
    answerKey: 'a',
  },
  {
    id: 'e-bey-06',
    trait: 'beyond_experience',
    format: 'prediction',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'Imagine a town under the sea. How would people get around?',
    spoken:
      'Imagine a whole town built under the sea, with water everywhere. How do you think people would get from house to house?',
    visual: '🌊   🏘️',
    options: [
      { key: 'a', text: 'On bicycles', symbol: '🚲' },
      { key: 'b', text: 'In little submarines', symbol: '🛥️' },
      { key: 'c', text: 'By walking on the water', symbol: '🚶' },
    ],
    answerKey: 'b',
  },

  // ---- Makes quick and valid generalizations ----
  {
    id: 'e-gen-05',
    trait: 'generalization',
    format: 'figure_series',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'What comes next?',
    spoken:
      'Look at the shapes. Triangle, triangle, star, triangle, triangle. What comes next?',
    figure: {
      kind: 'series',
      columns: 6,
      cells: [
        one({ kind: 'triangle', fill: 'solid', tone: 'go' }),
        one({ kind: 'triangle', fill: 'solid', tone: 'go' }),
        one({ kind: 'star', fill: 'solid', tone: 'happy' }),
        one({ kind: 'triangle', fill: 'solid', tone: 'go' }),
        one({ kind: 'triangle', fill: 'solid', tone: 'go' }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'A triangle', figure: one({ kind: 'triangle', fill: 'solid', tone: 'go' }) },
      { key: 'b', text: 'A star', figure: one({ kind: 'star', fill: 'solid', tone: 'happy' }) },
      { key: 'c', text: 'A circle', figure: one({ kind: 'circle', fill: 'solid', tone: 'primary' }) },
    ],
    answerKey: 'b',
  },
  {
    id: 'e-gen-06',
    trait: 'generalization',
    format: 'figure_matrix',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Which shape belongs in the empty box?',
    spoken:
      'Look at the four boxes. The top two go together, and the bottom two should go together the same way. Which shape belongs in the empty box?',
    figure: {
      kind: 'matrix',
      columns: 2,
      cells: [
        one({ kind: 'square', fill: 'solid', tone: 'cool', scale: 0.55 }),
        one({ kind: 'square', fill: 'solid', tone: 'cool', scale: 1.1 }),
        one({ kind: 'heart', fill: 'solid', tone: 'primary', scale: 0.55 }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'A big heart', figure: one({ kind: 'heart', fill: 'solid', tone: 'primary', scale: 1.1 }) },
      { key: 'b', text: 'A small heart', figure: one({ kind: 'heart', fill: 'solid', tone: 'primary', scale: 0.55 }) },
      { key: 'c', text: 'A big square', figure: one({ kind: 'square', fill: 'solid', tone: 'cool', scale: 1.1 }) },
    ],
    answerKey: 'a',
  },

  // ---- Sees cause and effect ----
  {
    id: 'e-cau-04',
    trait: 'cause_effect',
    format: 'prediction',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'You leave an ice cube on a sunny windowsill. What happens?',
    spoken:
      'Imagine you put an ice cube on a windowsill where the sun is shining. What do you think happens to it?',
    visual: '🧊   ☀️',
    options: [
      { key: 'a', text: 'It melts into water', symbol: '💧' },
      { key: 'b', text: 'It gets bigger', symbol: '⬆️' },
      { key: 'c', text: 'Nothing changes', symbol: '🚫' },
    ],
    answerKey: 'a',
  },

  {
    id: 'e-cau-05',
    trait: 'cause_effect',
    format: 'prediction',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    prompt: 'A plant is left in a dark cupboard for a long time. What happens?',
    spoken:
      'Imagine a plant that gets put in a dark cupboard, with no light at all, for a long time. What do you think happens to it?',
    visual: '🪴   🚪',
    options: [
      { key: 'a', text: 'It grows lots of flowers', symbol: '🌸' },
      { key: 'b', text: 'It goes floppy and dies', symbol: '🥀' },
      { key: 'c', text: 'It turns into a tree', symbol: '🌳' },
    ],
    answerKey: 'b',
  },

  // ---- Is keenly observant ----
  {
    id: 'e-obs-03',
    trait: 'observant',
    format: 'figure_classification',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    // The odd one out is the fill, not the shape — so it rewards looking
    // carefully rather than naming shapes.
    prompt: 'Which one does not belong?',
    spoken:
      'Look at the four circles. Three of them are coloured in all the way. One of them is not. Which one does not belong?',
    figure: {
      kind: 'group',
      columns: 4,
      cells: [
        one({ kind: 'circle', fill: 'solid', tone: 'cool' }),
        one({ kind: 'circle', fill: 'outline', tone: 'cool' }),
        one({ kind: 'circle', fill: 'solid', tone: 'cool' }),
        one({ kind: 'circle', fill: 'solid', tone: 'cool' }),
      ],
    },
    options: [
      { key: 'a', text: 'The first one', symbol: '1️⃣' },
      { key: 'b', text: 'The second one', symbol: '2️⃣' },
      { key: 'c', text: 'The third one', symbol: '3️⃣' },
      { key: 'd', text: 'The fourth one', symbol: '4️⃣' },
    ],
    answerKey: 'b',
  },
  {
    id: 'e-obs-04',
    trait: 'observant',
    format: 'spot_the_difference',
    type: 'mcq',
    ageBand: [5, 7],
    weight: 2,
    prompt: 'Three arrows point the same way. Which one is different?',
    spoken:
      'Look carefully at the four arrows. Three of them point the same way. One of them does not. Which one?',
    figure: {
      kind: 'group',
      columns: 4,
      cells: [
        one({ kind: 'arrow', fill: 'solid', tone: 'ink' }),
        one({ kind: 'arrow', fill: 'solid', tone: 'ink' }),
        one({ kind: 'arrow', fill: 'solid', tone: 'ink' }),
        one({ kind: 'arrow', fill: 'solid', tone: 'ink', rotate: 180 }),
      ],
    },
    options: [
      { key: 'a', text: 'The first one', symbol: '1️⃣' },
      { key: 'b', text: 'The second one', symbol: '2️⃣' },
      { key: 'c', text: 'The third one', symbol: '3️⃣' },
      { key: 'd', text: 'The fourth one', symbol: '4️⃣' },
    ],
    answerKey: 'd',
  },

  // ---- Chooses and enjoys challenging tasks ----
  {
    id: 'e-cha-02',
    trait: 'challenge_seeking',
    format: 'choice',
    type: 'challenge',
    ageBand: [4, 7],
    weight: 2,
    prompt: 'One more choice. Which puzzle would you like?',
    spoken:
      'You get to choose again. Would you like a quick one, or one that takes more thinking? Either is fine — pick the one you want.',
    visual: '⚡   or   🧠',
    options: [
      { key: 'easy', text: 'A quick one', symbol: '⚡' },
      { key: 'hard', text: 'A thinking one', symbol: '🧠' },
    ],
    hardKey: 'hard',
    followUp: { easy: 'e-cha2-easy', hard: 'e-cha2-hard' },
  },
  {
    id: 'e-cha2-easy',
    trait: 'observant',
    format: 'figure_classification',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 1,
    hidden: true,
    prompt: 'Which one is a different colour?',
    spoken: 'Here is your quick one. Three of these squares are the same colour. Which one is not?',
    figure: {
      kind: 'group',
      columns: 4,
      cells: [
        one({ kind: 'square', fill: 'solid', tone: 'cool' }),
        one({ kind: 'square', fill: 'solid', tone: 'cool' }),
        one({ kind: 'square', fill: 'solid', tone: 'happy' }),
        one({ kind: 'square', fill: 'solid', tone: 'cool' }),
      ],
    },
    options: [
      { key: 'a', text: 'The first one', symbol: '1️⃣' },
      { key: 'b', text: 'The second one', symbol: '2️⃣' },
      { key: 'c', text: 'The third one', symbol: '3️⃣' },
      { key: 'd', text: 'The fourth one', symbol: '4️⃣' },
    ],
    answerKey: 'c',
  },
  {
    id: 'e-cha2-hard',
    trait: 'generalization',
    format: 'figure_series',
    type: 'mcq',
    ageBand: [4, 7],
    weight: 2,
    hidden: true,
    prompt: 'The shapes are turning. Which one comes next?',
    spoken:
      'Here is your thinking one. Look at the arrow. It turns a little further each time. Which one comes next?',
    figure: {
      kind: 'series',
      columns: 4,
      cells: [
        one({ kind: 'arrow', fill: 'solid', tone: 'primary' }),
        one({ kind: 'arrow', fill: 'solid', tone: 'primary', rotate: 90 }),
        one({ kind: 'arrow', fill: 'solid', tone: 'primary', rotate: 180 }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'Turned again', figure: one({ kind: 'arrow', fill: 'solid', tone: 'primary', rotate: 270 }) },
      { key: 'b', text: 'Back to the start', figure: one({ kind: 'arrow', fill: 'solid', tone: 'primary' }) },
      { key: 'c', text: 'The same as before', figure: one({ kind: 'arrow', fill: 'solid', tone: 'primary', rotate: 180 }) },
    ],
    answerKey: 'a',
  },

  // =========================================================================
  // MIDDLE YEARS (8-12)
  // =========================================================================

  {
    id: 'm-abs-01',
    trait: 'abstract_concepts',
    format: 'classification',
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
    id: 'm-abs-02',
    trait: 'abstract_concepts',
    format: 'explanation',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt: 'In your own words, what is the difference between a rule and a habit?',
    timeLimitSeconds: 180,
    rubric: [
      '3 - Draws a real distinction: a rule comes from outside and is expected or enforced, a habit is something you do automatically by repetition. May use an example.',
      '2 - Touches one side of the distinction clearly but the other only vaguely.',
      '1 - Gives examples of each without explaining how they differ.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'm-bey-01',
    trait: 'beyond_experience',
    format: 'explanation',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'A friend says: "It rained today, so the picnic was cancelled. It is raining now, so tomorrow\'s picnic will be cancelled too." Do you agree? Explain why or why not.',
    timeLimitSeconds: 180,
    rubric: [
      "3 - Recognises the reasoning is uncertain: today's rain does not guarantee rain tomorrow, or that other factors decide a cancellation. States a clear reason.",
      '2 - Reaches a sensible conclusion with a partly-formed reason, but does not name the gap in the logic.',
      '1 - Answers with an opinion, a guess, or a restatement of the question.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'm-bey-02',
    trait: 'beyond_experience',
    format: 'explanation',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'Imagine a town where it is dark all winter and light all summer, day and night. Name one thing people there would do differently, and why.',
    timeLimitSeconds: 180,
    rubric: [
      '3 - Names a specific adaptation AND ties it to the cause: sleeping with blackout curtains because it never gets dark, using lamps all winter, different school hours.',
      '2 - Names a plausible difference without connecting it to the light, or reasons well about a related situation.',
      '1 - Describes the town without saying what anyone would do differently.',
      '0 - Blank, off-topic, or unintelligible.',
    ],
  },
  {
    id: 'm-gen-01',
    trait: 'generalization',
    format: 'analogy',
    type: 'mcq',
    ageBand: [7, 12],
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
    id: 'm-gen-02',
    trait: 'generalization',
    format: 'analogy',
    type: 'mcq',
    ageBand: [8, 12],
    weight: 2,
    prompt: 'In a code, CAT is written as DBU. Each letter moves forward one place. How would DOG be written?',
    options: [
      { key: 'a', text: 'EPH' },
      { key: 'b', text: 'CNF' },
      { key: 'c', text: 'EOH' },
      { key: 'd', text: 'DPH' },
    ],
    answerKey: 'a',
  },
  {
    id: 'm-gen-03',
    trait: 'generalization',
    format: 'number_series',
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
    id: 'm-gen-04',
    trait: 'generalization',
    format: 'figure_matrix',
    type: 'mcq',
    ageBand: [8, 12],
    weight: 2,
    prompt: 'Which shape belongs in the empty box?',
    spoken:
      'Across each row the arrow turns a quarter turn clockwise. Which arrow belongs in the empty box?',
    figure: {
      kind: 'matrix',
      columns: 3,
      cells: [
        one({ kind: 'arrow', fill: 'solid', tone: 'primary', rotate: 0 }),
        one({ kind: 'arrow', fill: 'solid', tone: 'primary', rotate: 90 }),
        one({ kind: 'arrow', fill: 'solid', tone: 'primary', rotate: 180 }),
        one({ kind: 'arrow', fill: 'solid', tone: 'cool', rotate: 0 }),
        one({ kind: 'arrow', fill: 'solid', tone: 'cool', rotate: 90 }),
        MISSING,
      ],
    },
    options: [
      { key: 'a', text: 'Pointing up', figure: one({ kind: 'arrow', fill: 'solid', tone: 'cool', rotate: 0 }) },
      { key: 'b', text: 'Pointing down', figure: one({ kind: 'arrow', fill: 'solid', tone: 'cool', rotate: 180 }) },
      { key: 'c', text: 'Pointing left', figure: one({ kind: 'arrow', fill: 'solid', tone: 'cool', rotate: 270 }) },
    ],
    answerKey: 'b',
  },
  {
    id: 'm-cau-01',
    trait: 'cause_effect',
    format: 'quantitative_relation',
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
    id: 'm-cau-02',
    trait: 'cause_effect',
    format: 'explanation',
    type: 'open',
    ageBand: [8, 12],
    weight: 2,
    prompt:
      'Two pencils cost the same as three erasers. One eraser costs 4 rupees. How much does one pencil cost? Show how you worked it out.',
    timeLimitSeconds: 180,
    rubric: [
      '3 - Correct answer (6) AND a clear method: three erasers cost 12, that equals two pencils, so one pencil is 6.',
      '2 - Correct answer with a thin method, or a correct method with a small arithmetic slip.',
      '1 - Wrong answer but shows a relevant first step.',
      '0 - Blank, off-topic, or a bare wrong number with no working.',
    ],
  },
  {
    id: 'm-obs-01',
    trait: 'observant',
    format: 'figure_classification',
    type: 'mcq',
    ageBand: [8, 12],
    weight: 2,
    prompt: 'Three of these are filled the same way. Which one is different?',
    figure: {
      kind: 'group',
      columns: 4,
      cells: [
        one({ kind: 'square', fill: 'half', tone: 'cool' }),
        one({ kind: 'circle', fill: 'half', tone: 'go' }),
        one({ kind: 'diamond', fill: 'solid', tone: 'happy' }),
        one({ kind: 'hexagon', fill: 'half', tone: 'primary' }),
      ],
    },
    options: [
      { key: 'a', text: 'The first', figure: one({ kind: 'square', fill: 'half', tone: 'cool' }) },
      { key: 'b', text: 'The second', figure: one({ kind: 'circle', fill: 'half', tone: 'go' }) },
      { key: 'c', text: 'The third', figure: one({ kind: 'diamond', fill: 'solid', tone: 'happy' }) },
      { key: 'd', text: 'The fourth', figure: one({ kind: 'hexagon', fill: 'half', tone: 'primary' }) },
    ],
    answerKey: 'c',
  },
  {
    id: 'm-cha-01',
    trait: 'challenge_seeking',
    format: 'choice',
    type: 'challenge',
    ageBand: [7, 12],
    weight: 2,
    prompt: 'You can pick your next question. Which would you like?',
    options: [
      { key: 'easy', text: 'A straightforward one', symbol: '🙂' },
      { key: 'hard', text: 'A hard one', symbol: '🤔' },
    ],
    hardKey: 'hard',
    followUp: { easy: 'm-cha-easy', hard: 'm-cha-hard' },
  },
  {
    id: 'm-cha-easy',
    trait: 'generalization',
    format: 'number_series',
    type: 'mcq',
    ageBand: [7, 12],
    weight: 1,
    hidden: true,
    prompt: 'What number comes next?    3, 6, 9, 12, ___',
    options: [
      { key: 'a', text: '13' },
      { key: 'b', text: '15' },
      { key: 'c', text: '18' },
    ],
    answerKey: 'b',
  },
  {
    id: 'm-cha-hard',
    trait: 'generalization',
    format: 'number_series',
    type: 'open',
    ageBand: [7, 12],
    weight: 2,
    hidden: true,
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
] satisfies Question[];

/** Highest score a single open-ended item can earn from the grader. */
export const OPEN_MAX_POINTS = 3;

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

/**
 * Structural problems across the whole bank, checked at startup so a broken
 * item is a line in the terminal rather than something a child discovers.
 */
export function bankProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const q of QUESTIONS) {
    if (seen.has(q.id)) problems.push(`${q.id}: duplicate id`);
    seen.add(q.id);

    if (q.ageBand[0] > q.ageBand[1]) problems.push(`${q.id}: ageBand is reversed`);

    if (q.type === 'mcq') {
      const keys = q.options.map((o) => o.key);
      if (!keys.includes(q.answerKey)) {
        problems.push(`${q.id}: answerKey "${q.answerKey}" is not one of the options`);
      }
      if (new Set(keys).size !== keys.length) problems.push(`${q.id}: duplicate option keys`);
    }

    if (q.type === 'challenge') {
      if (q.options.length !== 2) problems.push(`${q.id}: a challenge needs exactly two options`);
      if (!q.options.some((o) => o.key === q.hardKey)) {
        problems.push(`${q.id}: hardKey "${q.hardKey}" is not one of the options`);
      }
      for (const [key, target] of Object.entries(q.followUp)) {
        if (!q.options.some((o) => o.key === key)) {
          problems.push(`${q.id}: followUp key "${key}" is not an option`);
        }
        const followed = questionById(target);
        if (!followed) problems.push(`${q.id}: followUp "${target}" does not exist`);
        else if (!followed.hidden) problems.push(`${q.id}: followUp "${target}" should be hidden`);
      }
    }

    if (q.figure) {
      for (const p of figureProblems(q.figure)) problems.push(`${q.id}: ${p}`);
    }
  }

  // Reassessment only works if there is depth to draw on, and depth is a
  // per-age fact: a bank that looks healthy in total can still leave a
  // four-year-old with one item in a trait, because most of it is age-banded
  // out. Checking the whole bank at once hides exactly the case that matters.
  for (const [key, profile] of Object.entries(PROFILES)) {
    for (let age = profile.ageBand[0]; age <= profile.ageBand[1]; age++) {
      const atAge = QUESTIONS.filter(
        (q) => !q.hidden && age >= q.ageBand[0] && age <= q.ageBand[1]
      );

      for (const trait of TRAIT_ORDER) {
        if (TRAITS[trait].measurable !== 'direct') continue;
        const count = atAge.filter((q) => q.trait === trait).length;
        if (count < 2) {
          problems.push(
            `age ${age}: trait "${trait}" has ${count} item(s), so a reassessment at that age ` +
              `cannot cover it at all`
          );
        }
      }

      // Two full sessions is the minimum that makes the reassess button mean
      // anything. Below that the second round is a short remainder.
      const rounds = atAge.length / profile.maxQuestions;
      if (rounds < 2) {
        problems.push(
          `age ${age} (${key} profile): ${atAge.length} item(s) for sessions of ` +
            `${profile.maxQuestions}, so there is less than one full second round`
        );
      }
    }
  }

  return problems;
}

export interface SelectionResult {
  questions: Question[];
  followUps: Question[];
  poolExhausted: boolean;
  remainingUnseen: number;
}

/**
 * Pick the questions for a session.
 *
 * `exclude` carries the ids a child has already been given, so a reassessment
 * serves fresh material. That is the whole point of retaking: a second run on
 * the same items measures memory, not thinking.
 *
 * Selection takes a round-robin across traits rather than the first N, so a
 * session trimmed to the age cap still spreads across the form's rows instead
 * of exhausting one and never reaching the others.
 */
export function selectQuestions({
  age,
  limit,
  exclude = [],
  trait,
}: {
  age?: number;
  limit?: number;
  exclude?: string[];
  trait?: TraitKey;
}): SelectionResult {
  const excluded = new Set(exclude);

  const eligible = QUESTIONS.filter((q) => {
    if (trait && q.trait !== trait) return false;
    if (q.hidden) return false;
    if (excluded.has(q.id)) return false;
    if (age === undefined) return true;
    return age >= q.ageBand[0] && age <= q.ageBand[1];
  });

  const cap = limit ?? eligible.length;

  const byTrait = new Map<TraitKey, Question[]>();
  for (const q of eligible) {
    const list = byTrait.get(q.trait) ?? [];
    list.push(q);
    byTrait.set(q.trait, list);
  }

  const picked = new Set<Question>();
  let round = 0;
  while (picked.size < cap) {
    let addedThisRound = false;
    for (const trait of TRAIT_ORDER) {
      const list = byTrait.get(trait);
      const item = list?.[round];
      if (item && picked.size < cap) {
        picked.add(item);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round++;
  }

  // Keep the bank's order, so a session still reads as a coherent sequence.
  const questions = eligible.filter((q) => picked.has(q));

  // Follow-ups for any challenge item in this session, so choosing a path does
  // not need another round trip.
  const followUps: Question[] = [];
  for (const q of questions) {
    if (q.type !== 'challenge') continue;
    for (const target of Object.values(q.followUp)) {
      const followed = questionById(target);
      if (followed) followUps.push(followed);
    }
  }

  return {
    questions,
    followUps,
    poolExhausted: questions.length < cap,
    remainingUnseen: Math.max(0, eligible.length - questions.length),
  };
}

/** Join option texts the way a person would say them: "a, b, or c". */
function listForSpeech(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const last = items[items.length - 1] ?? '';
  return `${items.slice(0, -1).join(', ')}, or ${last}`;
}

/**
 * What the read-aloud voice should say. For anything with options this must
 * include them: a child who hears only the question and then sees words they
 * cannot read has been given half a question.
 */
export function speechTextFor(q: Question): string {
  const question = (q.spoken ?? q.prompt).trim();
  if (q.type === 'open') return question;

  const choices = listForSpeech(q.options.map((o) => o.text.trim()).filter(Boolean));
  if (!choices) return question;
  return `${question} Your choices are: ${choices}.`;
}

/**
 * What the app is allowed to see. Never ship `answerKey` or `rubric` to the
 * client — anything in a mobile bundle can be read by a determined user.
 */
export function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    trait: q.trait,
    type: q.type,
    format: q.format,
    prompt: q.prompt,
    options: q.type === 'open' ? null : q.options,
    timeLimitSeconds: q.timeLimitSeconds ?? null,
    visual: q.visual ?? null,
    figure: q.figure ?? null,
    spoken: q.spoken ?? null,
    followUp: q.type === 'challenge' ? q.followUp : null,
    speechText: speechTextFor(q),
  };
}
