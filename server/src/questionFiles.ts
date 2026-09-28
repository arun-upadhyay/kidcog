/**
 * Fixed, reviewed questions, read from server/questions/<category>.json.
 *
 * Rounds come only from these files (QUESTION_SOURCE=files, the default once
 * the folder has questions): no AI writes questions while a child waits, and
 * every question a child can see has been read by a person first. AI is still
 * used to check spoken answers and to write the parent's note.
 *
 * File format (one file per category):
 *   {
 *     "category": "humor",
 *     "questions": [
 *       { "id": "<uuid>", "age": 5, "reviewed": true, "type": "mcq", "prompt": "…", … }
 *     ]
 *   }
 * Edits are picked up automatically within a few seconds; no restart needed.
 *
 * Each entry is a full question (the same shape the server already scores),
 * plus the child age it is for. Keep "id" when editing a question, so children
 * who already had it are not given it again. A question with "reviewed": false
 * is still used; the flag is only a checklist for whoever reviews the files.
 * Delete an entry (or set "disabled": true) to stop it being used.
 *
 * npm run draft-questions writes and updates these files.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TRAIT_ORDER, type TraitKey } from './traits.js';
import type { GeneratedQuestion } from './generatedQuestions.js';

export const QUESTIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'questions');

export type FileQuestion = GeneratedQuestion & { age: number; reviewed?: boolean; disabled?: boolean };
export type QuestionFile = { category: TraitKey; questions: FileQuestion[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why an entry can't be used, or null if it is fine. Kept deliberately simple. */
function problemWith(q: FileQuestion, category: TraitKey): string | null {
  if (!q || typeof q !== 'object') return 'not a question';
  if (typeof q.id !== 'string' || !UUID.test(q.id)) return 'missing or invalid "id"';
  if (!Number.isInteger(q.age) || q.age < 4 || q.age > 12) return '"age" must be a whole number from 4 to 12';
  if (q.trait !== category) return `"trait" should be "${category}"`;
  if (typeof q.prompt !== 'string' || q.prompt.trim().length < 5) return 'missing "prompt"';
  if (q.type === 'mcq') {
    const options = (q as { options?: Array<{ key: string }> }).options;
    const answerKey = (q as { answerKey?: string }).answerKey;
    if (!Array.isArray(options) || options.length < 2) return 'multiple choice needs at least 2 options';
    if (!options.some(o => o.key === answerKey)) return '"answerKey" does not match any option';
    return null;
  }
  if (q.type === 'open') {
    const rubric = (q as { rubric?: unknown }).rubric;
    if (!Array.isArray(rubric) || rubric.length < 2) return 'a spoken question needs a "rubric" with at least 2 levels';
    return null;
  }
  return '"type" must be "mcq" or "open"';
}

let cache: Map<string, Map<string, GeneratedQuestion>> | null = null;
let problems: string[] = [];
let signature = '';
let checkedAt = 0;

/** Names and change times of the files, so edits are picked up without a restart. */
function currentSignature() {
  if (!existsSync(QUESTIONS_DIR)) return '';
  return readdirSync(QUESTIONS_DIR).filter(n => n.endsWith('.json')).sort()
    .map(n => { try { return `${n}:${statSync(path.join(QUESTIONS_DIR, n)).mtimeMs}`; } catch { return n; } }).join('|');
}

/** Changes whenever the files change (checked at most every few seconds). */
export function questionFilesVersion() { load(); return signature; }

const keyOf = (trait: string, age: number) => `${trait}|${age}`;

/** Reads the files, and reads them again when they change (checked every 5 s). */
function load() {
  if (cache && Date.now() - checkedAt < 5000) return cache;
  checkedAt = Date.now();
  const now = currentSignature();
  if (cache && now === signature) return cache;
  const reloading = cache !== null;
  signature = now;
  cache = new Map();
  problems = [];
  if (!existsSync(QUESTIONS_DIR)) return cache;
  for (const name of readdirSync(QUESTIONS_DIR).filter(n => n.endsWith('.json')).sort()) {
    const category = name.replace(/\.json$/, '') as TraitKey;
    if (!(TRAIT_ORDER as readonly string[]).includes(category)) { problems.push(`${name}: not a known category, skipped`); continue; }
    let file: QuestionFile;
    try { file = JSON.parse(readFileSync(path.join(QUESTIONS_DIR, name), 'utf8')) as QuestionFile; }
    catch (error) { problems.push(`${name}: could not be read (${error instanceof Error ? error.message : error})`); continue; }
    const seen = new Set<string>();
    (file.questions ?? []).forEach((entry, i) => {
      if (entry?.disabled) return;
      const problem = problemWith(entry, category) ?? (seen.has(entry.id) ? 'the same "id" is used twice' : null);
      if (problem) { problems.push(`${name} #${i + 1}: ${problem}`); return; }
      seen.add(entry.id);
      const { age, reviewed: _reviewed, disabled: _disabled, ...question } = entry;
      const bucket = cache!.get(keyOf(category, age)) ?? new Map<string, GeneratedQuestion>();
      bucket.set(entry.id, question as GeneratedQuestion);
      cache!.set(keyOf(category, age), bucket);
    });
  }
  if (reloading) console.log(`[bank] question files changed; reloaded ${[...cache.values()].reduce((n, b) => n + b.size, 0)} questions.`);
  if (problems.length) console.warn(`  ⚠ ${problems.length} question file entr${problems.length === 1 ? 'y was' : 'ies were'} skipped:\n    ${problems.slice(0, 20).join('\n    ')}${problems.length > 20 ? '\n    …' : ''}`);
  return cache;
}

/** The reviewed questions for one category and age, by id. */
export function fileQuestionsFor(trait: TraitKey, age: number): Map<string, GeneratedQuestion> {
  return load().get(keyOf(trait, age)) ?? new Map();
}

/** Every file question, grouped by category and age (for seeding the bank). */
export function allFileQuestions(): Array<{ trait: TraitKey; age: number; questions: GeneratedQuestion[] }> {
  return [...load().entries()].map(([key, bucket]) => {
    const [trait, age] = key.split('|');
    return { trait: trait as TraitKey, age: Number(age), questions: [...bucket.values()] };
  });
}

export function fileQuestionCount() {
  let total = 0;
  for (const bucket of load().values()) total += bucket.size;
  return total;
}

/**
 * Where rounds come from. "files" (the default once server/questions has
 * questions): only the reviewed files, never AI. "ai": the old behaviour, the
 * AI keeps writing new questions into the bank. Set QUESTION_SOURCE to choose.
 */
export function questionSource(): 'files' | 'ai' {
  const chosen = (process.env.QUESTION_SOURCE ?? '').trim().toLowerCase();
  if (chosen === 'ai') return 'ai';
  if (chosen === 'files') return 'files';
  return fileQuestionCount() > 0 ? 'files' : 'ai';
}

export function questionFileProblems() { load(); return [...problems]; }

/** For tests: forget what was read. */
export function resetQuestionFiles() { cache = null; problems = []; signature = ''; checkedAt = 0; }
