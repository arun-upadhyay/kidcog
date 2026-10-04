/**
 * Builds Animal Explorer quiz rounds from the facts in animals.ts.
 *
 * Every question is made from a rule ("can fly", "lives in the ocean") and the
 * wrong choices are picked only from animals that clearly do NOT fit it, so a
 * question always has exactly one right answer. `checkQuestion` re-checks that
 * and the tests run it over thousands of generated rounds.
 *
 * Difficulty (level 1–4, starting from the child's age):
 *   1  find the animal by name, who says "moo", listen to a real recording
 *   2  + name the picture, can it fly, feathers or shell, easy baby names
 *   3  + where it lives, what it eats, harder baby names, four choices
 *   4  + how many legs, which one is not a bird / is an insect, every animal
 */
import { ANIMALS, HOME_WORDS, withArticle, type Animal, type Home } from './animals';
import { RECORDED_CALLS } from './recordings';

export type Choice = { key: string; label: string; emoji?: string };
export interface AnimalQuestion {
  id: string;
  /** Shown on screen. */
  prompt: string;
  /** Read aloud. */
  speech: string;
  /** Show this animal big above the choices ("What is this animal?"). */
  show?: string;
  /** Play this animal's real recording with the question. */
  listen?: string;
  /** Choices are pictures (emoji) or words. */
  style: 'pictures' | 'words';
  choices: Choice[];
  answer: string;
  /** The animal the question is about: its fact is shown after, and it joins the album. */
  about: string;
}

type Pick = <T>(list: T[]) => T;
const pickFrom = (rand: () => number): Pick => list => list[Math.floor(rand() * list.length)]!;
function shuffled<T>(list: T[], rand: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Sounds that are really the same sound written differently. */
const SAME_SOUND: Record<string, string> = { bzzz: 'buzz', rawr: 'roar', grrr: 'roar' };
export const soundKey = (says: string) => { const k = says.toLowerCase(); return SAME_SOUND[k] ?? k; };

/** Animals too alike to be offered side by side (a tropical fish IS a fish; roosters cluck too). */
const RELATED = [['fish', 'tropical-fish', 'pufferfish'], ['hen', 'rooster'], ['dolphin', 'whale']];
export const related = (a: string, b: string) => a === b || RELATED.some(g => g.includes(a) && g.includes(b));

const EASY_BABIES = ['puppy', 'kitten', 'calf', 'piglet', 'lamb', 'foal', 'chick', 'duckling', 'cub', 'tadpole'];

export const defaultAnimalLevel = (age: number | undefined) => Math.max(1, Math.min(4, (age ?? 5) - 3));
const choicesFor = (level: number) => (level >= 3 ? 4 : 3);
/** Which animals a child at this level is asked about. */
const poolFor = (level: number) => ANIMALS.filter(a => a.level <= (level <= 1 ? 1 : level === 2 ? 2 : 3));

type Maker = (pool: Animal[], n: number, pick: Pick, rand: () => number) => AnimalQuestion | null;

/** n-1 different animals that do not match, plus the target, as picture choices. */
function pictureChoices(target: Animal, others: Animal[], n: number, rand: () => number): Choice[] | null {
  const seenEmoji = new Set([target.emoji]);
  const wrong: Animal[] = [];
  for (const a of shuffled(others, rand)) {
    if (related(a.key, target.key) || seenEmoji.has(a.emoji) || wrong.some(w => related(w.key, a.key))) continue;
    seenEmoji.add(a.emoji); wrong.push(a);
    if (wrong.length === n - 1) break;
  }
  if (wrong.length < n - 1) return null;
  return shuffled([target, ...wrong], rand).map(a => ({ key: a.key, label: a.name, emoji: a.emoji }));
}
const pictureQ = (id: string, prompt: string, speech: string, target: Animal, others: Animal[], n: number, rand: () => number, extra: Partial<AnimalQuestion> = {}): AnimalQuestion | null => {
  const choices = pictureChoices(target, others, n, rand);
  return choices ? { id, prompt, speech, style: 'pictures', choices, answer: target.key, about: target.key, ...extra } : null;
};

const MAKERS: Record<string, { from: number; weight: number; make: Maker }> = {
  find: { from: 1, weight: 4, make: (pool, n, pick, rand) => {
    const t = pick(pool);
    return pictureQ(`find:${t.key}`, `Find the ${t.name}!`, `Can you find the ${t.spoken ?? t.name}?`, t, pool, n, rand);
  } },
  says: { from: 1, weight: 3, make: (pool, n, pick, rand) => {
    const withSound = pool.filter(a => a.says);
    if (!withSound.length) return null;
    const t = pick(withSound);
    const sound = soundKey(t.says!);
    return pictureQ(`says:${t.key}`, `Who says “${t.says}”?`, `Who says ${t.says}?`, t, pool.filter(a => !a.says || soundKey(a.says) !== sound), n, rand);
  } },
  listen: { from: 1, weight: 2, make: (pool, n, pick, rand) => {
    const recorded = pool.filter(a => RECORDED_CALLS.includes(a.key) && a.says);
    if (!recorded.length) return null;
    const t = pick(recorded);
    return pictureQ(`listen:${t.key}`, 'Listen! 🔊 Which animal makes this sound?', 'Listen carefully. Which animal makes this sound?', t,
      pool.filter(a => a.key !== t.key && (!a.says || soundKey(a.says) !== soundKey(t.says!))), n, rand, { listen: t.key });
  } },
  name: { from: 2, weight: 3, make: (pool, n, pick, rand) => {
    const t = pick(pool);
    const wrong: Animal[] = [];
    for (const a of shuffled(pool, rand)) {
      if (!related(a.key, t.key) && !wrong.some(w => related(w.key, a.key))) wrong.push(a);
      if (wrong.length === n - 1) break;
    }
    if (wrong.length < n - 1) return null;
    return { id: `name:${t.key}`, prompt: 'What is this animal?', speech: 'What is this animal called?', show: t.key, style: 'words',
      choices: shuffled([t, ...wrong], rand).map(a => ({ key: a.key, label: a.name })), answer: t.key, about: t.key };
  } },
  flies: { from: 2, weight: 2, make: (pool, n, pick, rand) => {
    if (rand() < 0.35) {
      // Which bird cannot fly?
      const t = ANIMALS.find(a => a.key === 'penguin')!;
      return pictureQ('flies:penguin', 'Which bird can NOT fly?', 'Which bird can not fly?', t, ANIMALS.filter(a => a.kind === 'bird' && a.flies === true), n, rand);
    }
    const t = pick(ANIMALS.filter(a => a.flies === true && a.level <= 2));
    return pictureQ(`flies:${t.key}`, 'Which animal can fly?', 'Which animal can fly?', t, pool.filter(a => a.flies === false), n, rand);
  } },
  cover: { from: 2, weight: 2, make: (pool, n, pick, rand) => {
    const kind = pick(['feathers', 'shell', 'scales'] as const);
    const targets = ANIMALS.filter(a => a.cover === kind && a.level <= 2);
    const t = pick(targets);
    const words = { feathers: 'has feathers', shell: 'has a hard shell', scales: 'has scales' }[kind];
    // Wrong choices have a clearly different covering (fur or feathers), never "nothing said".
    const others = pool.filter(a => a.cover && a.cover !== kind && (kind !== 'scales' || a.cover !== 'shell'));
    return pictureQ(`cover:${kind}:${t.key}`, `Which animal ${words}?`, `Which animal ${words}?`, t, others, n, rand);
  } },
  baby: { from: 2, weight: 2, make: (pool, n, pick, rand) => {
    const easy = (a: Animal) => a.babies && EASY_BABIES.includes(a.babies[0]!);
    const candidates = pool.filter(a => a.babies && (n >= 4 || easy(a)));
    if (!candidates.length) return null;
    const t = pick(candidates);
    const right = t.babies![0]!;
    if (rand() < 0.5) {
      // A baby cow is called a …
      const names = [...new Set(ANIMALS.flatMap(a => a.babies ?? []))].filter(b => !t.babies!.includes(b) && (n >= 4 || EASY_BABIES.includes(b)));
      const wrong = shuffled(names, rand).slice(0, n - 1);
      if (wrong.length < n - 1) return null;
      return { id: `baby:${t.key}`, prompt: `A baby ${t.name} is called…`, speech: `What do we call a baby ${t.spoken ?? t.name}?`, show: t.key, style: 'words',
        choices: shuffled([right, ...wrong], rand).map(b => ({ key: b, label: b })), answer: right, about: t.key };
    }
    // Whose baby is a kitten?
    return pictureQ(`whose:${t.key}`, `Whose baby is called ${withArticle(right)}?`, `Whose baby is called ${withArticle(right)}?`, t,
      pool.filter(a => !a.babies?.includes(right)), n, rand);
  } },
  home: { from: 3, weight: 3, make: (pool, n, pick, rand) => {
    const home = pick(Object.keys(HOME_WORDS) as Home[]);
    // The answer lives mainly there; wrong choices never live there at all.
    const targets = ANIMALS.filter(a => a.homes[0] === home && a.level <= 2);
    if (!targets.length) return null;
    const t = pick(targets);
    return pictureQ(`home:${home}:${t.key}`, `Which animal lives ${HOME_WORDS[home]}?`, `Which animal lives ${HOME_WORDS[home]}?`, t,
      pool.filter(a => !a.homes.includes(home) && !a.homes.includes('long-ago')), n, rand);
  } },
  food: { from: 3, weight: 2, make: (pool, n, pick, rand) => {
    const plants = rand() < 0.5;
    const t = pick(ANIMALS.filter(a => a.diet === (plants ? 'plants' : 'meat') && a.level <= 2));
    const prompt = plants ? 'Which animal eats only plants?' : 'Which animal eats meat?';
    return pictureQ(`food:${t.key}`, prompt, prompt, t, pool.filter(a => a.diet === (plants ? 'meat' : 'plants')), n, rand);
  } },
  legs: { from: 4, weight: 2, make: (pool, n, pick, rand) => {
    const t = pick(pool.filter(a => a.legs !== undefined));
    const right = String(t.legs);
    const wrong = shuffled(['0', '2', '4', '6', '8'].filter(x => x !== right), rand).slice(0, n - 1);
    return { id: `legs:${t.key}`, prompt: `How many legs does ${withArticle(t.name)} have?`, speech: `How many legs does ${withArticle(t.spoken ?? t.name)} have?`,
      show: t.key, style: 'words', choices: shuffled([right, ...wrong], rand).map(x => ({ key: x, label: x })), answer: right, about: t.key };
  } },
  odd: { from: 4, weight: 2, make: (pool, n, pick, rand) => {
    if (rand() < 0.5) {
      // Which one is NOT a bird? (three birds and one animal that is not)
      const t = pick(pool.filter(a => a.kind !== 'bird' && a.kind !== 'reptile'));
      return pictureQ(`notbird:${t.key}`, 'Which one is NOT a bird?', 'Which one is not a bird?', t, ANIMALS.filter(a => a.kind === 'bird'), n, rand);
    }
    const t = pick(ANIMALS.filter(a => a.kind === 'insect' && a.level <= 2));
    // Spiders, snails and worms are the classic "not an insect" mix-ups.
    return pictureQ(`insect:${t.key}`, 'Which one is an insect? (Insects have six legs.)', 'Which one is an insect? Insects have six legs.', t,
      ANIMALS.filter(a => a.kind !== 'insect' && ['spider', 'scorpion', 'snail', 'crab', 'frog', 'mouse', 'bat', 'hen', 'lizard'].includes(a.key)), n, rand);
  } },
};

/** True when exactly one choice is right, by the same facts the question came from. */
export function checkQuestion(q: AnimalQuestion): string | null {
  const keys = q.choices.map(c => c.key);
  if (new Set(keys).size !== keys.length) return 'duplicate choice';
  if (!keys.includes(q.answer)) return 'answer missing';
  if (q.style === 'pictures' && new Set(q.choices.map(c => c.emoji)).size !== keys.length) return 'duplicate picture';
  const [kind, a] = q.id.split(':');
  const pairs = keys.flatMap((x, i) => keys.slice(i + 1).map(y => [x, y] as const));
  if ((q.style === 'pictures' || kind === 'name') && pairs.some(([x, y]) => related(x, y))) return 'look-alike animals side by side';
  const animal = (k: string) => ANIMALS.find(x => x.key === k)!;
  const fits: Record<string, (k: string) => boolean> = {
    find: k => related(k, a!),
    name: k => related(k, a!),
    says: k => !!animal(k).says && soundKey(animal(k).says!) === soundKey(animal(a!).says!),
    listen: k => !!animal(k).says && soundKey(animal(k).says!) === soundKey(animal(a!).says!),
    flies: k => (a === 'penguin' ? animal(k).flies === false : animal(k).flies !== false),
    cover: k => animal(k).cover === a,
    baby: k => animal(q.about).babies!.includes(k),
    whose: k => !!animal(k).babies?.includes(animal(a!).babies![0]!),
    home: k => animal(k).homes.includes(a as Home),
    food: k => animal(k).diet === animal(a!).diet,
    legs: k => k === String(animal(a!).legs),
    notbird: k => animal(k).kind !== 'bird',
    insect: k => animal(k).kind === 'insect',
  };
  const rule = fits[kind!];
  if (!rule) return `no check for ${kind}`;
  const right = keys.filter(k => rule(k));
  if (right.length !== 1 || right[0] !== q.answer) return `${right.length} right answers (${right.join(', ')})`;
  return null;
}

/** A round of `count` questions for this level, without repeating an animal. */
export function makeRound(level: number, count = 8, rand: () => number = Math.random): AnimalQuestion[] {
  const pick = pickFrom(rand);
  const pool = poolFor(level);
  const n = choicesFor(level);
  const makers = Object.entries(MAKERS).filter(([, m]) => m.from <= level).flatMap(([, m]) => Array<Maker>(m.weight).fill(m.make));
  const out: AnimalQuestion[] = [];
  const usedAbout = new Set<string>();
  const usedIds = new Set<string>();
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const q = pick(makers)(pool, n, pick, rand);
    if (!q || usedAbout.has(q.about) || usedIds.has(q.id) || checkQuestion(q)) continue;
    // Not two questions of the same type in a row.
    if (out.length && out[out.length - 1]!.id.split(':')[0] === q.id.split(':')[0]) continue;
    out.push(q); usedAbout.add(q.about); usedIds.add(q.id);
  }
  return out;
}
