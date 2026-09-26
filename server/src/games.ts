/**
 * Play-and-learn games, made by code instead of the AI.
 *
 * Maths is the clearest case: an AI is slow, costs money and sometimes gets
 * the arithmetic wrong, while a few lines of code make an endless supply of
 * questions that are instant, free and always right. The same goes for
 * sorting, ordering, patterns, shapes, memory and true-or-false, using the
 * hand-written content in gameContent.ts.
 *
 * Difficulty has five levels. The server starts from the child's age; the app
 * moves the level up or down as the child plays (see app/src/progress.ts).
 */
import { randomUUID } from 'node:crypto';
import type { GameKind, GameQuestion, GameResult, GameShape, GameSpec, GameThing, TraitKey } from './types.js';
import { COUNTABLES, FACTS, FLOATERS, HOPPERS, MATCHABLES, PATTERN_SETS, SEQUENCES, SIZE_LADDERS, SORT_SETS } from './gameContent.js';

export type Rng = () => number;

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)]!;
const int = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));
function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
/** `n` items from a list, keeping their original order. */
function subsetInOrder<T>(list: readonly T[], n: number, rng: Rng): T[] {
  const keep = new Set(shuffle(list.map((_, i) => i), rng).slice(0, n));
  return list.filter((_, i) => keep.has(i));
}
const plural = (thing: GameThing, n = 2) => (n === 1 ? thing.name : thing.plural ?? `${thing.name}s`);

/** Level 1 (just starting) to 5 (confident). */
export function defaultLevel(age: number) {
  if (age <= 4) return 1;
  if (age === 5) return 2;
  if (age === 6) return 3;
  if (age === 7) return 4;
  return 5;
}
export function clampLevel(level: number) {
  return Math.min(5, Math.max(1, Math.round(level)));
}
/** Biggest number in counting, adding and taking away, by level. */
const TOP = [5, 6, 8, 10, 12];
const topFor = (level: number) => TOP[level - 1]!;

/** The right answer plus nearby wrong ones, all between 0 and max, shuffled. */
export function numberChoices(answer: number, max: number, rng: Rng, how = 3): number[] {
  const out = new Set<number>([answer]);
  const nearby = shuffle([answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3], rng);
  for (const n of nearby) {
    if (out.size >= how) break;
    if (n >= 0 && n <= max) out.add(n);
  }
  for (let n = 0; out.size < how && n <= max + how; n++) out.add(n);
  return shuffle([...out], rng);
}

/** Which games each category plays. Categories not listed stay AI-only. */
export const GAME_KINDS: Partial<Record<TraitKey, GameKind[]>> = {
  mental_math: ['count', 'add', 'subtract', 'compare', 'numberline', 'tenframe', 'order', 'truefalse'],
  generalization: ['pattern'],
  categories_hierarchies: ['sort', 'oddoneout', 'order'],
  observant: ['shapes', 'match'],
  cause_effect: ['order'],
  how_things_work: ['truefalse'],
};

/**
 * How many questions in a round are games. Maths is games only (no AI at all);
 * the other listed categories mix about half games with the AI's questions,
 * which ask children to explain and imagine.
 */
export function gameShare(trait: TraitKey, count: number) {
  if (!GAME_KINDS[trait]) return 0;
  return trait === 'mental_math' ? count : Math.ceil(count / 2);
}

/** Some games need a bit more experience first. */
function unlocked(kind: GameKind, trait: TraitKey, level: number) {
  if (kind === 'numberline' || kind === 'tenframe') return level >= 2;
  if (trait === 'mental_math' && (kind === 'truefalse' || kind === 'order')) return level >= 2;
  return true;
}

type Made = { spec: GameSpec; prompt: string; spoken?: string };

const SHAPE_NAMES: Record<GameShape, string> = { circle: 'circle', square: 'square', triangle: 'triangle', star: 'star', heart: 'heart' };
const PATTERNS: Record<number, string[]> = {
  1: ['AB'],
  2: ['AB', 'AAB'],
  3: ['ABB', 'ABC', 'AAB'],
  4: ['AABB', 'ABC', 'ABB'],
  5: ['ABCD', 'AABB', 'ABBC'],
};

/** Makes one game of the given kind. */
export function makeGame(kind: GameKind, trait: TraitKey, level: number, rng: Rng = Math.random): Made {
  const top = topFor(level);
  switch (kind) {
    case 'count': {
      const thing = pick(COUNTABLES, rng);
      const count = int(2, top, rng);
      return {
        spec: { kind, thing, count, choices: numberChoices(count, top + 2, rng), answer: count },
        prompt: `How many ${plural(thing)}? Tap each one to count!`,
        spoken: `How many ${plural(thing)}? Tap each one to count, then choose the number.`,
      };
    }
    case 'add': {
      const thing = pick(COUNTABLES, rng);
      const a = int(1, top - 1, rng);
      const b = int(1, top - a, rng);
      return {
        spec: { kind, thing, a, b, choices: numberChoices(a + b, top + 2, rng), answer: a + b },
        prompt: `${a} ${plural(thing, a)}, and ${b} more ${b === 1 ? 'comes' : 'come'} along. How many ${plural(thing)} now?`,
      };
    }
    case 'subtract': {
      const thing = pick(FLOATERS, rng);
      const start = int(3, top, rng);
      const away = int(1, start - 1, rng);
      return {
        spec: { kind, thing, start, away, choices: numberChoices(start - away, top, rng), answer: start - away },
        prompt: `There are ${start} ${plural(thing)}. ${away} ${away === 1 ? 'flies' : 'fly'} away! How many are left?`,
      };
    }
    case 'compare': {
      const thing = pick(COUNTABLES, rng);
      const gap = level <= 2 ? 2 : 1;
      const a = int(1, top, rng);
      let b = int(1, top, rng);
      for (let guard = 0; Math.abs(a - b) < gap && guard < 50; guard++) b = int(1, top, rng);
      if (Math.abs(a - b) < gap) b = a + gap <= top ? a + gap : a - gap;
      const ask = level >= 2 && rng() < 0.5 ? 'fewer' : 'more';
      const answer = ask === 'more' ? (a > b ? 0 : 1) : a < b ? 0 : 1;
      return {
        spec: { kind, ask, groups: [{ thing, count: a }, { thing, count: b }], answer },
        prompt: `Which side has ${ask} ${plural(thing)}? Tap it.`,
      };
    }
    case 'numberline': {
      const animal = pick(HOPPERS, rng);
      const max = level <= 3 ? 10 : 20;
      const back = level >= 4 && rng() < 0.4;
      const size = int(1, level <= 2 ? 3 : 5, rng);
      const start = back ? int(size, max, rng) : int(0, max - size, rng);
      const hop = back ? -size : size;
      return {
        spec: { kind, max, start, hop, animal, answer: start + hop },
        prompt: `The ${animal.name} is on ${start}. It hops ${back ? 'back ' : ''}${size}. Where does it land? Tap the number.`,
      };
    }
    case 'tenframe': {
      const filled = int(level <= 2 ? 5 : 1, 9, rng);
      return {
        spec: { kind, filled, choices: numberChoices(10 - filled, 10, rng), answer: 10 - filled },
        prompt: `There are ${filled} dots. How many more make 10?`,
      };
    }
    case 'shapes': {
      const kinds = Object.keys(SHAPE_NAMES) as GameShape[];
      const target = pick(kinds, rng);
      const total = level <= 2 ? 6 : 9;
      const hits = int(2, level <= 2 ? 3 : 4, rng);
      const others = kinds.filter(k => k !== target);
      const shapes = shuffle([...Array.from({ length: hits }, () => target), ...Array.from({ length: total - hits }, () => pick(others, rng))], rng);
      return {
        spec: { kind, target, shapes, answer: shapes.flatMap((s, i) => (s === target ? [i] : [])) },
        prompt: `Tap all the ${SHAPE_NAMES[target]}s!`,
      };
    }
    case 'pattern': {
      const set = shuffle(pick(PATTERN_SETS, rng), rng);
      const unit = pick(PATTERNS[level] ?? PATTERNS[3]!, rng);
      const letters = [...unit].map(ch => set[ch.charCodeAt(0) - 65]!);
      const length = level <= 1 ? 6 : int(6, 8, rng);
      const full = Array.from({ length: length + 1 }, (_, i) => letters[i % letters.length]!);
      const next = full[length]!;
      const wrong = shuffle(set.filter(item => item.emoji !== next.emoji), rng).slice(0, 2);
      const choices = shuffle([next, ...wrong], rng);
      return {
        spec: { kind, sequence: full.slice(0, length), choices, answer: choices.findIndex(c => c.emoji === next.emoji) },
        prompt: 'What comes next? Tap it.',
      };
    }
    case 'sort': {
      const set = pick(SORT_SETS, rng);
      const each = level <= 2 ? 2 : level <= 4 ? 3 : 4;
      const tagged = [0, 1].flatMap(side => shuffle(set.groups[side]!, rng).slice(0, each).map(item => ({ item, side })));
      const mixed = shuffle(tagged, rng);
      return {
        spec: { kind, baskets: set.baskets, items: mixed.map(m => m.item), answer: mixed.map(m => m.side) },
        prompt: `Sort them: ${set.baskets[0].name.toLowerCase()} or ${set.baskets[1].name.toLowerCase()}?`,
        spoken: `Put each picture in the right basket: ${set.baskets[0].name.toLowerCase()}, or ${set.baskets[1].name.toLowerCase()}. Drag a picture to its basket, or tap it and then the basket.`,
      };
    }
    case 'order': {
      const how = level <= 3 ? 3 : 4;
      let inOrder: GameThing[];
      let ask: string;
      if (trait === 'mental_math') {
        const top2 = level <= 2 ? 10 : 20;
        const numbers = shuffle(Array.from({ length: top2 }, (_, i) => i + 1), rng).slice(0, how).sort((a, b) => a - b);
        inOrder = numbers.map(n => ({ emoji: String(n), name: String(n) }));
        ask = 'Tap the numbers from smallest to biggest.';
      } else if (trait === 'categories_hierarchies') {
        inOrder = subsetInOrder(pick(SIZE_LADDERS, rng), how, rng);
        ask = 'Tap them from smallest to biggest.';
      } else {
        const sequence = pick(SEQUENCES, rng);
        inOrder = subsetInOrder(sequence.steps, how, rng);
        ask = sequence.ask;
      }
      let shown = shuffle(inOrder.map((_, i) => i), rng);
      if (shown.every((v, i) => v === i)) shown = [...shown.slice(1), shown[0]!];
      return {
        spec: { kind, ask, items: shown.map(i => inOrder[i]!), answer: inOrder.map((_, step) => shown.indexOf(step)) },
        prompt: ask,
      };
    }
    case 'match': {
      const pairs = level <= 2 ? 3 : level <= 4 ? 4 : 5;
      return {
        spec: { kind, pairs: shuffle(MATCHABLES, rng).slice(0, pairs), answer: null },
        prompt: 'Find the matching pairs!',
        spoken: 'Find the matching pairs! Tap two cards to turn them over.',
      };
    }
    case 'oddoneout': {
      const set = pick(SORT_SETS, rng);
      const side = rng() < 0.5 ? 0 : 1;
      const size = level <= 2 ? 3 : 4;
      const same = shuffle(set.groups[side]!, rng).slice(0, size - 1);
      const odd = pick(set.groups[1 - side]!, rng);
      const items = shuffle([...same, odd], rng);
      return {
        spec: { kind, items, answer: items.indexOf(odd) },
        prompt: 'Which one does not belong with the others? Tap it.',
      };
    }
    case 'truefalse': {
      if (trait === 'mental_math') {
        const a = int(1, Math.floor(top / 2), rng);
        const b = int(1, Math.floor(top / 2), rng);
        const minus = level >= 3 && rng() < 0.4 && a !== b;
        const big = Math.max(a, b), small = Math.min(a, b);
        const right = minus ? big - small : a + b;
        const truth = rng() < 0.5;
        const shown = truth ? right : Math.max(0, right + (rng() < 0.5 ? -1 : 1) * int(1, 2, rng));
        const text = minus ? `${big} − ${small} = ${shown}` : `${a} + ${b} = ${shown}`;
        const spoken = minus ? `${big} take away ${small} is ${shown}.` : `${a} plus ${b} is ${shown}.`;
        return {
          spec: { kind, picture: text, answer: shown === right },
          prompt: `True or false? ${text}`,
          spoken: `True or false? ${spoken} Thumbs up for true, thumbs down for false.`,
        };
      }
      const fact = pick(FACTS, rng);
      return {
        spec: { kind, picture: fact.picture, answer: fact.answer },
        prompt: `True or false? ${fact.text}`,
        spoken: `True or false? ${fact.text} Thumbs up for true, thumbs down for false.`,
      };
    }
  }
}

const RUBRIC = [
  '3 - Solved it straight away.',
  '2 - Solved it with a second try or a slip or two.',
  '1 - Finished with help from trying again.',
  '0 - Did not reach the answer this time.',
];

/** `count` games for a round, varied so the same game doesn't come twice in a row. */
export function makeGames(trait: TraitKey, age: number, level: number, count: number, rng: Rng = Math.random): GameQuestion[] {
  const kinds = (GAME_KINDS[trait] ?? []).filter(kind => unlocked(kind, trait, level));
  if (kinds.length === 0 || count <= 0) return [];
  const plan: GameKind[] = [];
  let bag: GameKind[] = [];
  while (plan.length < count) {
    if (bag.length === 0) bag = shuffle(kinds, rng);
    const next = bag.findIndex(kind => kind !== plan[plan.length - 1]);
    plan.push(bag.splice(next >= 0 ? next : 0, 1)[0]!);
  }
  return plan.map(kind => {
    const made = makeGame(kind, trait, level, rng);
    return {
      id: randomUUID(), trait, type: 'game', format: 'game', ageBand: [age, age], weight: 1,
      prompt: made.prompt, ...(made.spoken ? { spoken: made.spoken } : {}), game: made.spec, rubric: RUBRIC,
    };
  });
}

// ---------------------------------------------------------------------------
// Scoring: done by code, re-checking the value the app sends.
// ---------------------------------------------------------------------------

function parseResult(raw: string): GameResult | null {
  try {
    const value = JSON.parse(raw) as Partial<GameResult>;
    if (typeof value !== 'object' || value === null) return null;
    return { v: value.v, mistakes: Math.max(0, Math.floor(Number(value.mistakes) || 0)), solved: value.solved === true };
  } catch {
    return null;
  }
}
const sameList = (a: unknown, b: number[]) => Array.isArray(a) && a.length === b.length && a.every((x, i) => Number(x) === b[i]);

/** In words, for the grown-up's report. */
export function describeAnswer(spec: GameSpec): string {
  switch (spec.kind) {
    case 'count': case 'add': case 'subtract': case 'tenframe': case 'numberline': return String(spec.answer);
    case 'compare': return spec.answer === 0 ? 'the left side' : 'the right side';
    case 'pattern': return spec.choices[spec.answer]?.name ?? '';
    case 'oddoneout': return spec.items[spec.answer]?.name ?? '';
    case 'truefalse': return spec.answer ? 'true' : 'false';
    case 'shapes': return `all ${spec.answer.length} ${spec.target}s`;
    case 'sort': return 'each picture in its basket';
    case 'order': return spec.answer.map(i => spec.items[i]?.name).join(', then ');
    case 'match': return 'all the pairs';
  }
}

export function scoreGame(spec: GameSpec, raw: string): { points: number; solved: boolean; shown: string; note: string } {
  const result = parseResult(raw);
  if (!result) return { points: 0, solved: false, shown: '(no answer)', note: 'No answer came through for this game.' };
  const { v, mistakes } = result;
  let solved: boolean;
  switch (spec.kind) {
    case 'truefalse': solved = v === spec.answer; break;
    case 'shapes': solved = Array.isArray(v) && sameList([...v].map(Number).sort((a, b) => a - b), [...spec.answer].sort((a, b) => a - b)); break;
    case 'sort': case 'order': solved = sameList(v, spec.answer); break;
    case 'match': solved = result.solved; break;
    default: solved = Number(v) === spec.answer;
  }
  const multiStep = spec.kind === 'shapes' || spec.kind === 'sort' || spec.kind === 'order' || spec.kind === 'match';
  const allowed = spec.kind === 'match' ? spec.pairs.length : 0;
  const points = !solved ? 0
    : multiStep ? (mistakes <= allowed ? 3 : mistakes <= allowed + 2 ? 2 : 1)
    : mistakes === 0 ? 3 : 2;
  const shown = multiStep ? (solved ? 'finished it' : 'did not finish') : spec.kind === 'truefalse' ? String(v) : spec.kind === 'compare' ? (Number(v) === 0 ? 'the left side' : 'the right side') : String(v ?? '');
  const note = !solved
    ? `Had a good try; the answer was ${describeAnswer(spec)}.`
    : points === 3 ? 'Got it straight away.'
    : multiStep ? `Finished with ${mistakes} slip${mistakes === 1 ? '' : 's'} on the way.`
    : 'Got it on the second try.';
  return { points, solved, shown, note };
}
