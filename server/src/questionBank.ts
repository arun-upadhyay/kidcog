/**
 * Rounds come from a shared bank of checked questions instead of being written
 * by the AI while a child waits.
 *
 * Since 2026-09: by default the bank holds only the reviewed questions in
 * server/questions/*.json (see questionFiles.ts) and the AI writes no
 * questions at all. The AI-writing path below still works with
 * QUESTION_SOURCE=ai, and is what `npm run draft-questions` uses to draft new
 * files for review.
 *
 * Why: logs/generation.log showed 8 s (2 questions) to 35 s (6 questions) per
 * round, with 22% of rounds failing outright, and every round paid for 2–4 AI
 * calls. A question depends only on the category and the child's age, so one
 * good question can serve every child of that age.
 *
 * How:
 *  - /api/test picks unseen questions for this child from the bank (a database
 *    read, well under a second) and hands back session copies.
 *  - When a child is running low on unseen questions, one batch is written in
 *    the background (two AI calls for ~8 questions, never while anyone waits).
 *  - The app calls /api/prefetch when a category is opened, so that batch is
 *    usually finished before "Let's play" is even tapped.
 *  - Only when a child has used up everything (or the bank is brand new) does
 *    a round wait for the AI, and then it joins the batch already running
 *    rather than starting another.
 *
 * Cost limits (all in server/.env, see .env.example):
 *  - QUESTION_BANK_MAX_PER_AGE caps how many questions one category and age
 *    can ever collect; beyond it children get repeats of the least-used ones.
 *  - QUESTION_DAILY_BATCH_LIMIT caps background batches per day.
 *  - QUESTION_BACKGROUND_PARALLEL caps AI calls running at once.
 *
 * Before the database migration is run, the same logic runs on an in-memory
 * bank, so nothing breaks; it just starts empty on every server restart.
 */
import { randomUUID } from 'node:crypto';
import { generateBatch, sameActivity, type BatchReason, type GeneratedQuestion } from './generatedQuestions.js';
import { bankCandidates, insertBankQuestions, markBankServed, retireBankQuestion, upsertBankQuestionsById, type BankCandidate } from './repository.js';
import { allFileQuestions, fileQuestionCount, fileQuestionsFor, questionFilesVersion, questionSource } from './questionFiles.js';
import { supabaseReady } from './supabase.js';
import type { TraitKey } from './traits.js';

function setting(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
const BATCH_SIZE = () => setting('QUESTION_BATCH_SIZE', 8);
const BANK_MAX = () => setting('QUESTION_BANK_MAX_PER_AGE', 120);
const LOW_WATER = () => setting('QUESTION_BANK_LOW_WATER', 12);
const DAILY_LIMIT = () => setting('QUESTION_DAILY_BATCH_LIMIT', 300);
const PARALLEL = () => setting('QUESTION_BACKGROUND_PARALLEL', 2);
/** The biggest round the app asks for; prefetch makes sure this many are ready. */
const LARGEST_ROUND = 6;

type Pickable = Pick<BankCandidate, 'id' | 'type' | 'skillFacet' | 'prompt' | 'servedCount'>;

/**
 * Choose `count` questions: the right mix of spoken and multiple-choice, no two
 * testing the same thing the same way, favouring the least-used questions with
 * a little shuffle so brothers and sisters don't get identical rounds.
 * Returns null when the pool cannot make a valid round.
 */
export function assembleRound<T extends Pickable>(pool: T[], count: number, random: () => number = Math.random): T[] | null {
  // A single question (the AI half of a mixed round) can be either kind.
  const need = count >= 5 ? 2 : count >= 2 ? 1 : 0;
  const ordered = pool
    .map(item => ({ item, rank: item.servedCount + random() * 3 }))
    .sort((a, b) => a.rank - b.rank)
    .map(entry => entry.item);
  const picked: T[] = [];
  const fits = (candidate: T) => !picked.includes(candidate) && !picked.some(p => sameActivity(p, candidate));
  for (const type of ['mcq', 'open'] as const) {
    for (const candidate of ordered) {
      if (picked.filter(p => p.type === type).length >= need) break;
      if (candidate.type === type && fits(candidate)) picked.push(candidate);
    }
  }
  for (const candidate of ordered) {
    if (picked.length >= count) break;
    if (fits(candidate)) picked.push(candidate);
  }
  const enough = picked.length === count && picked.filter(p => p.type === 'mcq').length >= need && picked.filter(p => p.type === 'open').length >= need;
  if (!enough) return null;
  // Mixed order, so a round doesn't always open with the same kind of question.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [picked[i], picked[j]] = [picked[j]!, picked[i]!];
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Where the bank lives: the database, or memory until the migration is run.
// ---------------------------------------------------------------------------

interface Store {
  candidates(parentId: string, childId: string, trait: string, age: number): Promise<BankCandidate[]>;
  insert(trait: string, age: number, questions: GeneratedQuestion[]): Promise<void>;
  served(childId: string, ids: string[]): Promise<void>;
  /** A parent reported it: never serve it again. */
  retire(id: string): Promise<void>;
  /** Store reviewed file questions under their own ids. Returns how many failed. */
  seed(trait: string, age: number, questions: GeneratedQuestion[]): Promise<number>;
}

const databaseStore: Store = {
  candidates: bankCandidates,
  insert: insertBankQuestions,
  // "Seen" is recorded by saving the session copies with their bank id.
  served: (_childId, ids) => markBankServed(ids),
  retire: retireBankQuestion,
  seed: upsertBankQuestionsById,
};

const memoryBank = new Map<string, BankCandidate[]>();
const memorySeen = new Map<string, Set<string>>();
const memoryStore: Store = {
  async candidates(_parentId, childId, trait, age) {
    const seen = memorySeen.get(childId) ?? new Set();
    return (memoryBank.get(keyOf(trait, age)) ?? [])
      .map(c => ({ ...c, seen: seen.has(c.id) }))
      .sort((a, b) => a.servedCount - b.servedCount);
  },
  async insert(trait, age, questions) {
    const list = memoryBank.get(keyOf(trait, age)) ?? [];
    for (const q of questions) {
      if (list.some(c => c.prompt.toLowerCase() === q.prompt.toLowerCase())) continue;
      list.push({ id: q.id, type: q.type as 'open' | 'mcq', skillFacet: q.skillFacet ?? '', prompt: q.prompt, question: q, servedCount: 0, seen: false });
    }
    memoryBank.set(keyOf(trait, age), list);
  },
  async served(childId, ids) {
    const seen = memorySeen.get(childId) ?? new Set<string>();
    ids.forEach(id => seen.add(id));
    memorySeen.set(childId, seen);
    for (const list of memoryBank.values()) for (const c of list) if (ids.includes(c.id)) c.servedCount++;
  },
  async retire(id) {
    memoryRetired.add(id);
    for (const [key, list] of memoryBank) memoryBank.set(key, list.filter(c => c.id !== id));
  },
  async seed(trait, age, questions) {
    const list = (memoryBank.get(keyOf(trait, age)) ?? []).filter(c => !questions.some(q => q.id === c.id));
    for (const q of questions) {
      if (memoryRetired.has(q.id)) continue;
      list.push({ id: q.id, type: q.type as 'open' | 'mcq', skillFacet: q.skillFacet ?? '', prompt: q.prompt, question: q, servedCount: 0, seen: false });
    }
    memoryBank.set(keyOf(trait, age), list);
    return 0;
  },
};
const memoryRetired = new Set<string>();

let useMemory = false;
function isMissingBank(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /question_bank|bank_candidates|bank_mark_served|PGRST202|42P01|42883|schema cache/i.test(message);
}
/** Runs a bank operation, switching to the in-memory bank if the tables aren't there yet. */
async function withStore<T>(run: (store: Store) => Promise<T>): Promise<T> {
  // No database configured at all (local tests): keep everything in memory.
  if (!useMemory && !supabaseReady()) useMemory = true;
  if (useMemory) return run(memoryStore);
  try {
    return await run(databaseStore);
  } catch (error) {
    if (!isMissingBank(error)) throw error;
    useMemory = true;
    console.warn('  ⚠ Question bank tables are missing, so questions are kept in memory until the server restarts.\n    Run supabase/migrations/202609280001_question_bank.sql to keep them (and save AI cost).');
    return run(memoryStore);
  }
}

const keyOf = (trait: string, age: number) => `${trait}|${age}`;

// ---------------------------------------------------------------------------
// Topping up: one batch at a time per category and age, a few at once overall,
// and a daily ceiling on background work.
// ---------------------------------------------------------------------------

const running = new Map<string, Promise<number>>();
let active = 0;
const waiting: Array<() => void> = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= PARALLEL()) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try { return await work(); }
  finally { active--; waiting.shift()?.(); }
}

let budgetDay = '';
let batchesToday = 0;
function allowBatch(reason: BatchReason) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) { budgetDay = today; batchesToday = 0; }
  // A child waiting on screen still gets questions past the soft limit, but
  // not without end: twice the limit is a hard stop.
  const limit = reason === 'live' ? DAILY_LIMIT() * 2 : DAILY_LIMIT();
  if (batchesToday >= limit) {
    console.warn(`[bank] daily AI batch limit reached (${batchesToday}); skipping a ${reason} batch. Raise QUESTION_DAILY_BATCH_LIMIT if this is expected.`);
    return false;
  }
  batchesToday++;
  return true;
}

/**
 * Writes one or more batches for a category and age and adds the good,
 * non-repeating questions to the bank. Joins a batch already running for the
 * same category and age instead of starting another. Resolves to how many
 * questions were added.
 */
function topUp(trait: TraitKey, age: number, reason: BatchReason, existing: BankCandidate[], batches = 1): Promise<number> {
  const key = keyOf(trait, age);
  const already = running.get(key);
  if (already) return already;
  const work = (async () => {
    if (existing.length >= BANK_MAX()) return 0;
    const make = () => allowBatch(reason)
      ? generateBatch(age, trait, BATCH_SIZE(), { reason, existingPrompts: existing.map(c => c.prompt) })
      : Promise.resolve([] as GeneratedQuestion[]);
    // A waiting child goes straight in; background work queues for a slot.
    const runs = Array.from({ length: batches }, () => (reason === 'live' ? make() : slot(make)));
    const made = (await Promise.allSettled(runs)).flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    const fresh: GeneratedQuestion[] = [];
    const described = (q: GeneratedQuestion) => ({ skillFacet: q.skillFacet ?? '', prompt: q.prompt });
    for (const q of made) {
      if (existing.some(c => sameActivity(c, described(q)))) continue;
      if (fresh.some(f => sameActivity(described(f), described(q)))) continue;
      fresh.push(q);
    }
    await withStore(store => store.insert(trait, age, fresh));
    if (made.length === 0 && batches > 0) throw new Error('The AI could not make questions just now.');
    return fresh.length;
  })();
  running.set(key, work);
  work.then(() => running.delete(key), () => running.delete(key));
  return work;
}

function topUpInBackground(trait: TraitKey, age: number, reason: BatchReason, existing: BankCandidate[]) {
  topUp(trait, age, reason, existing).catch(error => console.warn(`[bank] background top-up for ${trait} age ${age} failed: ${error instanceof Error ? error.message : error}`));
}

// ---------------------------------------------------------------------------
// What the API calls
// ---------------------------------------------------------------------------

export type RoundSource = 'bank' | 'fresh' | 'repeat';

// ---------------------------------------------------------------------------
// Reviewed question files (the default): no AI, instant.
// ---------------------------------------------------------------------------

let seeding: Promise<void> | null = null;
let seededVersion = '';
/** Puts the file questions into the bank (again whenever the files change), so use is tracked per child. */
export function seedFromFiles(): Promise<void> {
  const version = questionFilesVersion();
  if (!seeding || version !== seededVersion) {
    seededVersion = version;
    seeding = (async () => {
      let failed = 0;
      for (const group of allFileQuestions()) failed += await withStore(store => store.seed(group.trait, group.age, group.questions));
      console.log(`[bank] ${fileQuestionCount()} reviewed questions loaded from server/questions${failed ? ` (${failed} could not be stored; see warnings above)` : ''}.`);
    })().catch(error => {
      seeding = null; // try again on the next round
      throw error;
    });
  }
  return seeding;
}

const warnedNoFile = new Set<string>();
function warnNoFile(trait: string, age: number) {
  if (warnedNoFile.has(keyOf(trait, age))) return;
  warnedNoFile.add(keyOf(trait, age));
  console.warn(`[bank] no reviewed questions for ${trait} age ${age} in server/questions; using questions already in the bank. Run npm run draft-questions.`);
}

/** Up to `count` of the least-used questions, ignoring the spoken/tap mix (last resort). */
function anyRound(pool: BankCandidate[], count: number): BankCandidate[] | null {
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => a.servedCount - b.servedCount + (Math.random() - 0.5)).slice(0, Math.min(count, pool.length));
}

async function roundFromFiles(input: { parentId: string; childId: string; age: number; trait: TraitKey; count: number }) {
  const { parentId, childId, age, trait, count } = input;
  await seedFromFiles();
  const reviewed = fileQuestionsFor(trait, age);
  // The bank tells us which of these this child has had (and hides reported ones);
  // the file supplies the reviewed wording.
  const stored = await withStore(store => store.candidates(parentId, childId, trait, age));
  const pool = reviewed.size > 0
    ? stored
      .filter(c => reviewed.has(c.id))
      .map(c => { const question = reviewed.get(c.id)!; return { ...c, prompt: question.prompt, type: question.type as 'open' | 'mcq', skillFacet: question.skillFacet ?? '', question }; })
    // No reviewed file for this activity and age yet: use the questions already
    // stored in the bank (made earlier), but never ask the AI for new ones.
    : (warnNoFile(trait, age), stored);
  const unseen = pool.filter(c => !c.seen);
  let source: RoundSource = 'bank';
  let picked = assembleRound(unseen, count);
  if (!picked) { picked = assembleRound(pool, count) ?? anyRound(pool, count); source = 'repeat'; }
  if (!picked) throw new Error('There are no questions ready for this activity and age yet. Please try another activity.');
  const ids = picked.map(c => c.id);
  void withStore(store => store.served(childId, ids)).catch(error => console.warn(`[bank] could not record use: ${error instanceof Error ? error.message : error}`));
  const questions: GeneratedQuestion[] = picked.map(c => ({ ...c.question, id: randomUUID(), bankQuestionId: c.id }));
  return { questions, source };
}

/** A round for this child: session copies of bank questions, with where they came from. */
export async function roundForChild(input: { parentId: string; childId: string; age: number; trait: TraitKey; count: number }) {
  if (questionSource() === 'files') return roundFromFiles(input);
  const { parentId, childId, age, trait, count } = input;
  const load = () => withStore(store => store.candidates(parentId, childId, trait, age));
  let pool = await load();
  let unseen = pool.filter(c => !c.seen);
  let picked = assembleRound(unseen, count);
  let source: RoundSource = 'bank';

  if (!picked) {
    // Not enough new questions for this child: wait for (or start) a batch.
    // Two at once for a big round on an empty bank, so one batch with a few
    // dropped questions can't leave it short.
    const batches = count >= 5 && unseen.length < LARGEST_ROUND ? 2 : 1;
    try { await topUp(trait, age, 'live', pool, batches); }
    catch (error) { console.warn(`[bank] live top-up failed: ${error instanceof Error ? error.message : error}`); }
    pool = await load();
    unseen = pool.filter(c => !c.seen);
    picked = assembleRound(unseen, count);
    source = 'fresh';
    if (!picked) {
      // The AI is unavailable, the budget is spent, or the bank is full and
      // this child has done it all: repeat their least-used questions.
      picked = assembleRound(pool, count);
      source = 'repeat';
    }
  }
  if (!picked) throw new Error('Could not put a round together for this activity just now. Please try again in a moment.');

  const ids = picked.map(c => c.id);
  void withStore(store => store.served(childId, ids)).catch(error => console.warn(`[bank] could not record use: ${error instanceof Error ? error.message : error}`));
  // Keep a round's worth or two ready for next time, without holding this one up.
  if (unseen.length - picked.length < LOW_WATER()) topUpInBackground(trait, age, 'refill', pool);

  const questions: GeneratedQuestion[] = picked.map(c => ({ ...c.question, id: randomUUID(), bankQuestionId: c.id }));
  return { questions, source };
}

/**
 * Called when a category is opened: if this child could not get a full round
 * from the bank right now, start making one so it is ready (or nearly) by the
 * time "Let's play" is tapped. Never waits for the AI.
 */
export async function prefetchForChild(input: { parentId: string; childId: string; age: number; trait: TraitKey; largest?: number }) {
  // Reviewed files are always ready; nothing to make ahead.
  if (questionSource() === 'files') return { ready: true, working: false };
  const { parentId, childId, age, trait } = input;
  const largest = input.largest ?? LARGEST_ROUND;
  if (largest <= 0) return { ready: true, working: false };
  const pool = await withStore(store => store.candidates(parentId, childId, trait, age));
  const unseen = pool.filter(c => !c.seen);
  const ready = assembleRound(unseen, largest) !== null;
  if (!ready || unseen.length < LOW_WATER()) topUpInBackground(trait, age, 'prefetch', pool);
  return { ready, working: running.has(keyOf(trait, age)) };
}

/** For the fill script: top a category and age up to `target` questions. */
export async function fillBank(trait: TraitKey, age: number, target: number) {
  let pool = await withStore(store => store.candidates('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', trait, age));
  let added = 0;
  for (let attempt = 0; pool.length < target && attempt < Math.ceil(target / 4); attempt++) {
    added += await topUp(trait, age, 'fill-script', pool);
    pool = await withStore(store => store.candidates('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', trait, age));
  }
  return { added, total: pool.length };
}

export function bankStatus() {
  return { source: questionSource(), fileQuestions: fileQuestionCount(), store: useMemory ? 'memory' : 'database', batchesToday, running: [...running.keys()] };
}

/** Every stored question for a category and age (for the draft script's export). */
export async function bankQuestionsFor(trait: TraitKey, age: number) {
  const none = '00000000-0000-0000-0000-000000000000';
  return withStore(store => store.candidates(none, none, trait, age));
}

/** A parent reported this bank question: take it out of every future round. */
export async function retireQuestion(bankQuestionId: string) {
  await withStore(store => store.retire(bankQuestionId));
}
