/**
 * Undo a parent's account deletion within the 30-day grace period.
 *
 *   npm run restore-account -- parent@example.com
 *
 * Unblocks sign-in and clears the deletion flag. Their children and results
 * are untouched, because nothing is erased until the grace period ends.
 * Note: a running API server caches "deleted" for that parent until it restarts.
 */
import 'dotenv/config';
import { supabaseAdmin, supabaseReady } from './supabase.js';
import { restoreAccount } from './accountDeletion.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) { console.error('Usage: npm run restore-account -- parent@example.com'); process.exit(1); }
if (!supabaseReady()) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env.'); process.exit(1); }

let found: { id: string; email?: string } | undefined;
for (let page = 1; !found; page++) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error(error.message); process.exit(1); }
  found = data.users.find(user => user.email?.toLowerCase() === email);
  if (data.users.length < 1000) break;
}
if (!found) { console.error(`No account found for ${email}. It may already have been erased.`); process.exit(1); }

const { data: flag } = await supabaseAdmin.from('parent_accounts').select('deleted_at,purge_after').eq('id', found.id).maybeSingle();
if (!flag?.deleted_at) { console.log(`${email} is not marked as deleted. Nothing to do.`); process.exit(0); }

await restoreAccount(found.id);
console.log(`Restored ${email}. They can sign in again. (Restart the API server if it is running.)`);
