export type LearningKey = 'letter-garden' | 'counting-picnic' | 'number-pairs' | 'number-trail';
export const LEARNING_GAMES = [
  { key: 'letter-garden' as const, emoji: '🌻', name: 'Letter Garden', blurb: 'Find letters and match big to small', background: '#E5F5EA', border: '#63AA7D', ink: '#34734E', unlockAfter: 0, isNew: true },
  { key: 'counting-picnic' as const, emoji: '🧺', name: 'Counting Picnic', blurb: 'Count tasty treats from 1 to 20', background: '#FFF4D6', border: '#F4C966', ink: '#8A5A0A', unlockAfter: 0, isNew: true },
  { key: 'number-pairs' as const, emoji: '🃏', name: 'Number Pairs', blurb: 'Match numbers to groups of dots', background: '#EEE9FF', border: '#A68AE2', ink: '#5D439B', unlockAfter: 0, isNew: true },
  { key: 'number-trail' as const, emoji: '🚂', name: 'Number Trail', blurb: 'Fill the gap and try skip counting', background: '#E5F3FF', border: '#68A8D6', ink: '#2F6F9D', unlockAfter: 0, isNew: true },
];
export type Round = { prompt: string; picture: string; answer: string; options: string[] };
export function mix<T>(items: T[], rng = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [copy[i], copy[j]] = [copy[j]!, copy[i]!]; }
  return copy;
}
export function makeRound(kind: Exclude<LearningKey, 'number-pairs'>, level: number, rng = Math.random): Round {
  const n = (max: number) => Math.floor(rng() * max);
  const options = (answer: number, max: number) => mix([answer, ...mix(Array.from({ length: max }, (_, i) => i + 1).filter(x => x !== answer), rng).slice(0, 3)], rng).map(String);
  if (kind === 'letter-garden') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; const letter = letters[n(level === 1 ? 8 : 26)]!;
    const lower = level >= 2;
    return { prompt: lower ? `Find the lowercase letter for ${letter}.` : `Find the letter ${letter}.`, picture: `🌻 ${letter} 🌻`, answer: lower ? letter.toLowerCase() : letter,
      options: mix([letter, ...mix([...letters].filter(x => x !== letter), rng).slice(0, 3)], rng).map(x => lower ? x.toLowerCase() : x) };
  }
  if (kind === 'counting-picnic') {
    const max = level === 1 ? 5 : level === 2 ? 10 : 20; const count = n(max) + 1;
    const fruit = ['🍎', '🍓', '🍊', '🍐'][n(4)]!;
    return { prompt: 'Tap each piece of fruit to count it. How many are there?', picture: Array(count).fill(fruit).join(' '), answer: String(count), options: options(count, max) };
  }
  const step = level < 2 ? 1 : level === 2 ? 2 : level === 3 ? 5 : 10;
  const start = (n(4) + 1) * step; const gap = 1 + n(3); const values = Array.from({ length: 5 }, (_, i) => start + i * step); const answer = values[gap]!;
  return { prompt: `Count by ${step}. Which number is missing?`, picture: values.map((x, i) => i === gap ? '?' : String(x)).join(' → '), answer: String(answer), options: options(answer, start + 5 * step) };
}
export type PairCard = { id: string; value: number; face: string; label: string };
export function makeDeck(level: number, rng = Math.random): PairCard[] {
  const values = mix([1, 2, 3, 4, 5, 6], rng).slice(0, Math.min(6, Math.max(3, level + 2)));
  return mix(values.flatMap(value => [
    { id: `n${value}`, value, face: String(value), label: String(value) },
    { id: `d${value}`, value, face: '●'.repeat(value), label: `${value} dots` },
  ]), rng);
}
