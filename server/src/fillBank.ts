/**
 * Fill the shared question bank ahead of time, so even the first child to try
 * a category never waits for the AI.
 *
 *   npm run fill-bank                         show the plan and estimated cost
 *   npm run fill-bank -- --yes                do it (all categories, ages 4–7)
 *   npm run fill-bank -- --ages 5,6 --target 30 --traits humor,memory --yes
 *
 * --target is questions per category and age (default 24: four 6-question
 * rounds for a child before anything repeats; the app keeps topping up after).
 * Safe to run again: categories already at the target are skipped.
 */
import 'dotenv/config';
import { TRAIT_ORDER, type TraitKey } from './traits.js';
import { fillBank, bankStatus } from './questionBank.js';

const args = process.argv.slice(2);
const value = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const ages = (value('ages') ?? '4,5,6,7').split(',').map(Number).filter(a => Number.isInteger(a) && a >= 4 && a <= 12);
const target = Math.max(6, Number(value('target') ?? 24) || 24);
const traits = (value('traits') ? value('traits')!.split(',') : [...TRAIT_ORDER]).filter((t): t is TraitKey => (TRAIT_ORDER as readonly string[]).includes(t));
const confirmed = args.includes('--yes');
const unknown = (value('traits')?.split(',') ?? []).filter(t => !(TRAIT_ORDER as readonly string[]).includes(t));
if (unknown.length) console.log(`\nIgnoring unknown categories: ${unknown.join(', ')}. Valid ones: ${TRAIT_ORDER.join(', ')}`);

// Rough gpt-4o-mini figures for one batch of 8 (write + review): ~5,500 input
// and ~3,600 output tokens. Check current prices before relying on this.
const COST_PER_BATCH_USD = 0.003;
const batchesEach = Math.ceil(target / 6);
const pairs = traits.length * ages.length;

console.log(`\nFill plan: ${traits.length} categories × ${ages.length} ages (${ages.join(', ')}) = ${pairs} banks, up to ${target} questions each.`);
console.log(`At most about ${pairs * batchesEach} AI batches ≈ $${(pairs * batchesEach * COST_PER_BATCH_USD).toFixed(2)} with ${process.env.OPENAI_QUESTION_MODEL || 'gpt-4o-mini'} (less if some banks are already full).`);
if (!confirmed) { console.log('\nNothing done. Add --yes to run it.\n'); process.exit(0); }

let added = 0;
for (const age of ages) {
  for (const trait of traits) {
    try {
      const result = await fillBank(trait, age, target);
      added += result.added;
      console.log(`  ${result.total >= target ? '✓' : '…'} age ${age}  ${trait.padEnd(28)} ${String(result.total).padStart(3)} questions (+${result.added})`);
    } catch (error) {
      console.log(`  ✗ age ${age}  ${trait.padEnd(28)} ${error instanceof Error ? error.message : error}`);
    }
  }
}
const status = bankStatus();
console.log(`\nAdded ${added} questions. Bank: ${status.store}; ${status.batchesToday} AI batches used.\n`);
if (status.store === 'memory') console.log('The bank tables are missing, so nothing was kept. Run supabase/migrations/202609280001_question_bank.sql first.\n');
process.exit(0);
