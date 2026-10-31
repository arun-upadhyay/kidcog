import { US_STATES, type UsState } from './usStates';

/**
 * Rounds for the "USA Map" game: one state is coloured in on the map and the
 * child picks its name from four. Every one of the 50 states can come up; no
 * state is asked twice in a round, and the four names are always different.
 */
export type StateQuestion = { answer: string; choices: string[] };

export const STATE_BY_CODE: Record<string, UsState> = Object.fromEntries(US_STATES.map(s => [s.code, s]));

function shuffled<T>(list: T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

export function makeStateRound(size = 8, random: () => number = Math.random): StateQuestion[] {
  const codes = US_STATES.map(s => s.code);
  return shuffled(codes, random).slice(0, Math.min(size, codes.length)).map(answer => {
    const others = shuffled(codes.filter(code => code !== answer), random).slice(0, 3);
    return { answer, choices: shuffled([answer, ...others], random) };
  });
}

/** What Cog reads out: the question, then the four names. */
export function questionSpeech(q: StateQuestion) {
  const names = q.choices.map(code => STATE_BY_CODE[code]!.name);
  return `Which state is coloured in? Is it ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}?`;
}
