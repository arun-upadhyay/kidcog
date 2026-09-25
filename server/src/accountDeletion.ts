/**
 * Parent account deletion: flag now, erase after PURGE_AFTER_DAYS.
 *
 * 1. scheduleAccountDeletion() marks the account deleted in parent_accounts,
 *    bans the login in Supabase Auth (so the parent cannot sign back in) and
 *    signs out every device.
 * 2. requireParent (index.ts) refuses every API call from a flagged account,
 *    which also covers an access token that was issued before the ban.
 * 3. purgeDeletedAccounts() runs on a timer and deletes the auth user once the
 *    grace period is over. Every table cascades from auth.users, so the child
 *    profiles, sessions, questions, answers and results go with it.
 *
 * Undo within the grace period: `npm run restore-account -- parent@example.com`.
 */
import { supabaseAdmin, supabaseReady } from './supabase.js';

export const PURGE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Looked up on every API call, so remember the answer briefly. A deleted
// account is remembered until this server restarts: the restore script runs
// as a separate process and cannot clear this cache, so restart after a restore.
const cache = new Map<string, { deleted: boolean; at: number }>();
const CACHE_MS = 60_000;
let warnedMissingTable = false;

function warnMissingTable(message: string) {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.warn(
    `\n  ⚠  Account deletion is not set up: ${message}\n` +
    '     Run supabase/migrations/202609250001_parent_account_deletion.sql in the Supabase SQL editor.\n'
  );
}

/** True when this parent has deleted their account. */
export async function isAccountDeleted(parentId: string): Promise<boolean> {
  const hit = cache.get(parentId);
  if (hit && (hit.deleted || Date.now() - hit.at < CACHE_MS)) return hit.deleted;
  const { data, error } = await supabaseAdmin
    .from('parent_accounts').select('deleted_at').eq('id', parentId).maybeSingle();
  if (error) {
    // Fail open: a missing migration must not lock every parent out of the app.
    warnMissingTable(error.message);
    return false;
  }
  const deleted = Boolean(data?.deleted_at);
  cache.set(parentId, { deleted, at: Date.now() });
  return deleted;
}

export async function scheduleAccountDeletion(parentId: string, accessToken: string): Promise<{ purgeAfter: string }> {
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + PURGE_AFTER_DAYS * DAY_MS);

  const { error } = await supabaseAdmin.from('parent_accounts').upsert(
    { id: parentId, deleted_at: now.toISOString(), purge_after: purgeAfter.toISOString() },
    { onConflict: 'id' }
  );
  if (error) {
    warnMissingTable(error.message);
    throw new Error('Account deletion is not set up on the server yet.');
  }
  cache.set(parentId, { deleted: true, at: Date.now() });

  // Block sign-in (password and Google) until the purge. A day longer than the
  // grace period so the ban cannot lapse before the account is erased.
  const ban = await supabaseAdmin.auth.admin.updateUserById(parentId, {
    ban_duration: `${(PURGE_AFTER_DAYS + 1) * 24}h`,
  });
  if (ban.error) console.error(`  ✗ Could not block sign-in for deleted account ${parentId}: ${ban.error.message}`);

  // End every session on every device. The API check above already refuses
  // them; this stops token refreshes too.
  const out = await supabaseAdmin.auth.admin.signOut(accessToken, 'global');
  if (out.error) console.warn(`  ⚠ Could not sign out all devices for ${parentId}: ${out.error.message}`);

  console.log(`  • Parent account ${parentId} deleted; data will be erased after ${purgeAfter.toISOString()}.`);
  return { purgeAfter: purgeAfter.toISOString() };
}

/** Permanently erase accounts whose grace period is over. */
export async function purgeDeletedAccounts(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('parent_accounts').select('id')
    .not('deleted_at', 'is', null).lte('purge_after', new Date().toISOString());
  if (error) { warnMissingTable(error.message); return 0; }
  let erased = 0;
  for (const row of data ?? []) {
    // Deleting the auth user cascades to every table, this one included.
    const result = await supabaseAdmin.auth.admin.deleteUser(row.id);
    if (result.error) {
      console.error(`  ✗ Could not erase deleted account ${row.id}: ${result.error.message}`);
      continue;
    }
    cache.delete(row.id);
    erased += 1;
  }
  if (erased > 0) console.log(`  • Erased ${erased} deleted parent account(s) and their data.`);
  return erased;
}

/** Run the purge shortly after start-up and then every six hours. */
export function startPurgeSchedule(): void {
  if (!supabaseReady()) return;
  const run = () => { purgeDeletedAccounts().catch(err => console.error('  ✗ Account purge failed:', err)); };
  setTimeout(run, 15_000).unref();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}

/** Undo a deletion inside the grace period (used by the restore-account script). */
export async function restoreAccount(parentId: string): Promise<void> {
  const unban = await supabaseAdmin.auth.admin.updateUserById(parentId, { ban_duration: 'none' });
  if (unban.error) throw new Error(`Could not unblock sign-in: ${unban.error.message}`);
  const { error } = await supabaseAdmin.from('parent_accounts').delete().eq('id', parentId);
  if (error) throw new Error(`Could not clear the deletion flag: ${error.message}`);
  cache.delete(parentId);
}
