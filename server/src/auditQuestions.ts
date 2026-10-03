import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { QUESTIONS_DIR, validateFileQuestion, type FileQuestion, type QuestionFile } from './questionFiles.js';
import { TRAIT_ORDER, type TraitKey } from './traits.js';

type Issue = { file: string; number?: number; id?: string; message: string };
const issues: Issue[] = [];
const seenIds = new Map<string, string>();
const seenPrompts = new Map<string, string>();
const buckets = new Map<string, number>();
let active = 0;
let disabled = 0;
let reviewed = 0;

const add = (file: string, message: string, number?: number, id?: string) => issues.push({ file, number, id, message });
const canonical = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

if (!existsSync(QUESTIONS_DIR)) add(QUESTIONS_DIR, 'question directory does not exist');
else for (const name of readdirSync(QUESTIONS_DIR).filter(name => name.endsWith('.json')).sort()) {
  const full = path.join(QUESTIONS_DIR, name);
  let file: QuestionFile;
  try { file = JSON.parse(readFileSync(full, 'utf8')) as QuestionFile; }
  catch (error) { add(name, `invalid JSON: ${error instanceof Error ? error.message : String(error)}`); continue; }
  const category = name.replace(/\.json$/, '') as TraitKey;
  if (file.category !== category) add(name, `category must be "${category}"`);
  if (!Array.isArray(file.questions)) { add(name, 'questions must be an array'); continue; }
  file.questions.forEach((q: FileQuestion, index: number) => {
    const number = index + 1;
    if (q.disabled) { disabled++; return; }
    active++;
    if (q.reviewed === true) reviewed++;
    const problem = validateFileQuestion(q, category);
    if (problem) add(name, problem, number, q?.id);
    const oldId = seenIds.get(q.id);
    if (oldId) add(name, `duplicate id; first used by ${oldId}`, number, q.id);
    else seenIds.set(q.id, `${name} #${number}`);
    const prompt = `${category}|${q.age}|${canonical(q.prompt ?? '')}`;
    const oldPrompt = seenPrompts.get(prompt);
    if (prompt && oldPrompt) add(name, `duplicate prompt; first used by ${oldPrompt}`, number, q.id);
    else if (prompt) seenPrompts.set(prompt, `${name} #${number}`);
    const key = `${category}|${q.age}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });
}

for (const trait of TRAIT_ORDER) for (const age of [4, 5, 6, 7]) {
  if (trait === 'mental_math') continue; // This category is intentionally generated entirely by deterministic games.
  const count = buckets.get(`${trait}|${age}`) ?? 0;
  if (count < 5) add(`${trait}.json`, `only ${count} active questions for age ${age}; at least 5 are required to build a round`);
}

console.log(`Question bank: ${active} active, ${disabled} disabled, ${reviewed} marked reviewed.`);
if (issues.length) {
  console.error(`Found ${issues.length} issue${issues.length === 1 ? '' : 's'}:`);
  for (const issue of issues) console.error(`- ${issue.file}${issue.number ? ` #${issue.number}` : ''}${issue.id ? ` (${issue.id})` : ''}: ${issue.message}`);
  process.exitCode = 1;
} else {
  console.log('All deterministic question checks passed.');
}
