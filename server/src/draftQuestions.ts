/**
 * Drafts the fixed question files in server/questions/ for a person to review.
 *
 *   npm run draft-questions                       show the plan and estimated cost
 *   npm run draft-questions -- --yes              draft up to 20 per category and age (ages 4–7), then write the files
 *   npm run draft-questions -- --export-only      no AI: copy what is already in the Supabase bank into the files (free)
 *   npm run draft-questions -- --per 25 --ages 5,6 --traits humor,curiosity --yes
 *   npm run draft-questions -- --review-only      just rebuild questions/REVIEW.md after editing the files
 *   npm run draft-questions -- --yes --parallel 6 draft more activities at once (default 4)
 *
 * Each activity and age is saved as soon as it is done, so stopping with
 * Ctrl+C loses nothing; run it again to carry on. A running server picks up
 * the new questions within a few seconds.
 *
 * It never changes or removes a question already in a file, so it is safe to
 * run again after reviewing: it only adds questions for categories and ages
 * that are still short. New ones are marked "reviewed": false.
 *
 * Uses the AI (and OPENAI_API_KEY in server/.env) only to draft; the app then
 * serves the files with no AI involved.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { TRAIT_ORDER, TRAITS, type TraitKey } from './traits.js';
import { gameShare } from './games.js';
import { bankQuestionsFor, bankStatus, fillBank } from './questionBank.js';
import { QUESTIONS_DIR, type FileQuestion, type QuestionFile } from './questionFiles.js';

const args = process.argv.slice(2);
const value = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name: string) => args.includes(`--${name}`);
const ages = (value('ages') ?? '4,5,6,7').split(',').map(Number).filter(a => Number.isInteger(a) && a >= 4 && a <= 12);
const per = Math.max(6, Number(value('per') ?? 20) || 20);
const exportOnly = flag('export-only');
const reviewOnly = flag('review-only');
const confirmed = flag('yes') || exportOnly;
const parallel = Math.min(8, Math.max(1, Number(value('parallel') ?? 4) || 4));
// This script is the one place where many AI batches are expected: lift the
// server's background limits for this run only (unless set explicitly).
process.env.QUESTION_BACKGROUND_PARALLEL ||= String(parallel);
process.env.QUESTION_DAILY_BATCH_LIMIT ||= '5000';
const requested = value('traits') ? value('traits')!.split(',') : [...TRAIT_ORDER];
// "Number magic" is all games (made by code), so it needs no written questions.
const traits = requested.filter((t): t is TraitKey => (TRAIT_ORDER as readonly string[]).includes(t)).filter(t => gameShare(t, 6) < 6);

const fileOf = (trait: TraitKey) => path.join(QUESTIONS_DIR, `${trait}.json`);
function readFile(trait: TraitKey): QuestionFile {
  if (!existsSync(fileOf(trait))) return { category: trait, questions: [] };
  return JSON.parse(readFileSync(fileOf(trait), 'utf8')) as QuestionFile;
}
const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

function writeReview() {
  const lines: string[] = ['# KidCog questions — review sheet', '', 'Generated from the files in this folder by `npm run draft-questions -- --review-only`. Edit the **.json files**, not this sheet.', '', '| Category | ' + ages.map(a => `Age ${a}`).join(' | ') + ' | Reviewed |', '|---|' + ages.map(() => '---').join('|') + '|---|'];
  const sections: string[] = [];
  for (const trait of TRAIT_ORDER) {
    if (!existsSync(fileOf(trait))) continue;
    const file = readFile(trait);
    const active = file.questions.filter(q => !q.disabled);
    const reviewed = active.filter(q => q.reviewed).length;
    lines.push(`| ${TRAITS[trait].label} (\`${trait}\`) | ` + ages.map(a => String(active.filter(q => q.age === a).length)).join(' | ') + ` | ${reviewed}/${active.length} |`);
    sections.push(`\n## ${TRAITS[trait].label} — \`${trait}.json\`\n`);
    for (const age of [...new Set(active.map(q => q.age))].sort((a, b) => a - b)) {
      sections.push(`\n### Age ${age}\n`);
      active.filter(q => q.age === age).forEach((q, i) => {
        const tick = q.reviewed ? '✅' : '⬜';
        sections.push(`${i + 1}. ${tick} **${q.prompt.replace(/\n/g, ' ')}** _(${q.type === 'mcq' ? 'tap an answer' : 'spoken answer'}, id ${q.id.slice(0, 8)})_`);
        if (q.type === 'mcq') {
          const mcq = q as FileQuestion & { options: Array<{ key: string; text: string; symbol?: string }>; answerKey: string };
          for (const o of mcq.options) sections.push(`   - ${o.key === mcq.answerKey ? '✔️' : '·'} ${o.symbol ? `${o.symbol} ` : ''}${o.text}`);
        } else if (q.type === 'open') {
          const open = q as FileQuestion & { rubric: string[] };
          open.rubric.forEach(band => sections.push(`   - ${band}`));
        }
      });
    }
  }
  writeFileSync(path.join(QUESTIONS_DIR, 'REVIEW.md'), [...lines, ...sections, ''].join('\n'));
}

mkdirSync(QUESTIONS_DIR, { recursive: true });
if (reviewOnly) { writeReview(); console.log(`\nRebuilt ${path.join(QUESTIONS_DIR, 'REVIEW.md')}\n`); process.exit(0); }

const COST_PER_BATCH_USD = 0.003; // rough gpt-4o-mini figure per batch of 8; check current prices
const short = traits.flatMap(trait => ages.map(age => ({ trait, age, have: readFile(trait).questions.filter(q => q.age === age && !q.disabled).length }))).filter(x => x.have < per);
console.log(`\nDraft plan: up to ${per} questions for each of ${traits.length} categories × ages ${ages.join(', ')}.`);
console.log(`${short.length} category/age pairs are still short.${exportOnly ? ' Export only: no AI will be used.' : ` At most about ${short.length * Math.ceil(per / 6)} AI batches ≈ $${(short.length * Math.ceil(per / 6) * COST_PER_BATCH_USD).toFixed(2)}.`}`);
if (!confirmed) { console.log('\nNothing done. Add --yes to draft with AI, or --export-only to copy what the bank already has.\n'); process.exit(0); }

let added = 0;
let finished = 0;
const started = Date.now();
const elapsed = () => { const s = Math.round((Date.now() - started) / 1000); return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`; };

/** One activity: its short ages one after another, saving the file after each. */
async function draftTrait(trait: TraitKey) {
  const file = readFile(trait);
  const save = () => {
    file.questions.sort((a, b) => a.age - b.age);
    writeFileSync(fileOf(trait), JSON.stringify({ category: trait, questions: file.questions }, null, 2) + '\n');
  };
  for (const age of ages) {
    const have = () => file.questions.filter(q => q.age === age && !q.disabled);
    if (have().length >= per) continue;
    const before = have().length;
    if (!exportOnly) {
      console.log(`  … ${elapsed()}  drafting ${trait} age ${age} (has ${before}, want ${per})`);
      try { await fillBank(trait, age, per); }
      catch (error) { console.log(`  ✗ ${trait} age ${age}: ${error instanceof Error ? error.message : error}`); }
    }
    const inFile = new Set(file.questions.map(q => q.id));
    const prompts = new Set(file.questions.map(q => norm(q.prompt)));
    const rows = (await bankQuestionsFor(trait, age)).sort((a, b) => a.servedCount - b.servedCount);
    for (const row of rows) {
      if (have().length >= per) break;
      if (inFile.has(row.id) || prompts.has(norm(row.prompt))) continue;
      const { id: _id, bankQuestionId: _bank, age: _age, reviewed: _reviewed, ...payload } = row.question as FileQuestion;
      file.questions.push({ id: row.id, age, reviewed: false, ...payload } as FileQuestion);
      inFile.add(row.id); prompts.add(norm(row.prompt)); added++;
    }
    save();
    finished++;
    console.log(`  ${have().length >= per ? '✓' : '…'} ${elapsed()}  ${trait} age ${age}: ${have().length} questions (+${have().length - before})   [${finished}/${short.length} done]`);
  }
}

// A few activities at once; each activity's own ages stay in order (one file each).
const queue = [...new Set(short.map(x => x.trait))];
await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
  for (let trait = queue.shift(); trait; trait = queue.shift()) await draftTrait(trait);
}));
writeReview();
const status = bankStatus();
console.log(`\nAdded ${added} questions to server/questions (${status.batchesToday} AI batches used).`);
console.log('Next: read server/questions/REVIEW.md, fix or delete anything in the .json files, set "reviewed": true. A running server picks up changes within a few seconds.\n');
process.exit(0);
