import { supabaseAdmin } from './supabase.js';
import { computeEntitlement, entitlementConfig, usageDay, type Entitlement, type Usage } from './entitlement.js';

/**
 * Reads and records each account's usage (table account_usage, migration
 * 202610240001_explore_and_subscribe.sql) and turns it into what is unlocked.
 *
 * Fails open: if the table is missing or the database is unreachable, the
 * family keeps full access and the server log says why. A child should never
 * be locked out because of a server problem.
 */
export type UsageKind = 'seen' | 'activity_started' | 'activity_completed' | 'play_round';

type UsageRow = {
  explore_started_at: string | null; activities_completed: number; play_rounds: number; active_days: number;
  usage_date: string | null; activities_started_today: number; premium_until: string | null;
};
const toUsage = (row: UsageRow | null): Usage | null => row && ({
  exploreStartedAt: row.explore_started_at,
  activitiesCompleted: row.activities_completed,
  playRounds: row.play_rounds,
  activeDays: row.active_days,
  usageDate: row.usage_date,
  activitiesStartedToday: row.activities_started_today,
  premiumUntil: row.premium_until,
});

let warned = false;
function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(`  ⚠ Explore/subscribe usage is not available, so every family keeps full access: ${err instanceof Error ? err.message : err}`);
  console.warn('    Run the migration supabase/migrations/202610240001_explore_and_subscribe.sql (npm run migrate -- --yes).');
}

/**
 * Used whenever usage cannot be read. Still says whether subscriptions are
 * switched on (so parents can see the plan), but nothing is locked or counted.
 */
function failOpen(parentId: string): Entitlement {
  const config = entitlementConfig();
  const e = computeEntitlement(parentId, null, config);
  return e.status === 'premium' ? { ...e, usageReady: false } : { ...e, status: config.enabled ? 'exploring' : 'open', full: true, canSubscribe: false, activitiesLeftToday: null, usageReady: false };
}

/** For /health: is subscriptions switched on, and can the usage table be read? */
let lastCheck: { at: number; ready: boolean; problem: string | null } | null = null;
export async function subscriptionHealth() {
  const config = entitlementConfig();
  if (!config.enabled) return { enabled: false, usageTable: 'not needed' as const, problem: null };
  if (!lastCheck || Date.now() - lastCheck.at > 60_000) {
    try {
      const { error } = await supabaseAdmin.from('account_usage').select('parent_id').limit(1);
      lastCheck = { at: Date.now(), ready: !error, problem: error ? `${error.message} — run supabase/migrations/202610240001_explore_and_subscribe.sql (npm run migrate -- --yes)` : null };
    } catch (err) {
      lastCheck = { at: Date.now(), ready: false, problem: err instanceof Error ? err.message : String(err) };
    }
  }
  return { enabled: true, usageTable: lastCheck.ready ? 'ok' as const : 'missing' as const, problem: lastCheck.problem, exploreDays: config.exploreDays, plan: config.plan };
}

/**
 * Record one piece of usage (or just read it, with 'seen') and return the
 * account's entitlement afterwards.
 */
export async function trackUsage(parentId: string, kind: UsageKind, now = new Date()): Promise<Entitlement> {
  const config = entitlementConfig();
  try {
    const { data, error } = await supabaseAdmin.rpc('record_account_usage', {
      p_parent: parentId, p_kind: kind, p_today: usageDay(now), p_start_explore: config.enabled,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as UsageRow | null;
    return computeEntitlement(parentId, toUsage(row), config, now);
  } catch (err) {
    warnOnce(err);
    return failOpen(parentId);
  }
}

/** What is unlocked right now, without counting anything. */
export async function readEntitlement(parentId: string, now = new Date()): Promise<Entitlement> {
  const config = entitlementConfig();
  if (!config.enabled) return computeEntitlement(parentId, null, config, now);
  try {
    const { data, error } = await supabaseAdmin.from('account_usage')
      .select('explore_started_at,activities_completed,play_rounds,active_days,usage_date,activities_started_today,premium_until')
      .eq('parent_id', parentId).maybeSingle();
    if (error) throw new Error(error.message);
    // First visit while switched on: start the explore clock.
    if (!data || !(data as UsageRow).explore_started_at) return trackUsage(parentId, 'seen', now);
    return computeEntitlement(parentId, toUsage(data as UsageRow), config, now);
  } catch (err) {
    warnOnce(err);
    return failOpen(parentId);
  }
}
