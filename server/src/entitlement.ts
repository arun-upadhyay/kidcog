/**
 * Explore first, subscribe later.
 *
 * Every family starts by exploring with everything open and no prices
 * anywhere. Once they have clearly used KidCog (enough finished activities, or
 * play on enough different days) the parent is invited to subscribe to
 * KidCog Plus. When the explore period ends without a subscription, the
 * account moves to a free tier: Play Zone basics and a few thinking
 * activities a day. Nothing the child earned is ever taken away.
 *
 * The whole feature is behind SUBSCRIPTIONS_ENABLED. Switched off (the
 * default), every account is 'open': no limits, no invite, no prices.
 *
 * This file is pure (no database), so the rules are easy to test.
 */

export type EntitlementStatus = 'open' | 'exploring' | 'invited' | 'free' | 'premium';

export type Usage = {
  exploreStartedAt: string | null;
  activitiesCompleted: number;
  playRounds: number;
  activeDays: number;
  usageDate: string | null;
  activitiesStartedToday: number;
  premiumUntil: string | null;
};

export type EntitlementConfig = {
  enabled: boolean;
  exploreDays: number;
  inviteAfterActivities: number;
  inviteAfterDays: number;
  freeActivitiesPerDay: number;
  /** Play Zone games that need KidCog Plus on the free tier. */
  premiumGames: string[];
  /** Accounts given KidCog Plus by hand (testing, friends, reviewers). */
  premiumParentIds: string[];
  /** The one plan offered: an early-supporter subscription. Shown to parents as written. */
  plan: { name: string; price: string };
};

export type Entitlement = {
  enabled: boolean;
  status: EntitlementStatus;
  /** Everything unlocked right now (open, exploring, invited, premium). */
  full: boolean;
  /** Show the parent the invite card and the Plans entry. */
  canSubscribe: boolean;
  usage: { activitiesCompleted: number; playRounds: number; activeDays: number };
  exploreEndsAt: string | null;
  /** Free tier only: thinking activities still allowed today (null = no limit). */
  activitiesLeftToday: number | null;
  freeActivitiesPerDay: number;
  premiumGames: string[];
  premiumUntil: string | null;
  plan: { name: string; price: string };
  /** False when usage could not be read (table missing or database down): full access, no limits, nothing counted. */
  usageReady: boolean;
};

const number = (value: string | undefined, fallback: number, min = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== undefined && value.trim() !== '' ? Math.max(min, Math.floor(parsed)) : fallback;
};
const list = (value: string | undefined) => (value ?? '').split(',').map(item => item.trim()).filter(Boolean);

/** Read the settings from server/.env (see .env.example for what each one means). */
export function entitlementConfig(env: NodeJS.ProcessEnv = process.env): EntitlementConfig {
  return {
    enabled: env.SUBSCRIPTIONS_ENABLED === '1' || env.SUBSCRIPTIONS_ENABLED === 'true',
    exploreDays: number(env.EXPLORE_DAYS, 14, 1),
    inviteAfterActivities: number(env.INVITE_AFTER_ACTIVITIES, 5, 1),
    inviteAfterDays: number(env.INVITE_AFTER_DAYS, 3, 1),
    freeActivitiesPerDay: number(env.FREE_ACTIVITIES_PER_DAY, 3, 0),
    premiumGames: env.PREMIUM_GAMES === undefined ? ['animals', 'states', 'art-music'] : list(env.PREMIUM_GAMES),
    premiumParentIds: list(env.PREMIUM_PARENT_IDS),
    // Must match the price set on the store products once payments are connected.
    plan: { name: env.PLAN_NAME?.trim() || 'KidCog Plus · Early supporter', price: env.PLAN_PRICE?.trim() || '$1 a month' },
  };
}

/** The calendar day usage is counted in (UTC, so every server agrees). */
export const usageDay = (now: Date) => now.toISOString().slice(0, 10);

export function computeEntitlement(parentId: string, usage: Usage | null, config: EntitlementConfig, now = new Date()): Entitlement {
  const counts = {
    activitiesCompleted: usage?.activitiesCompleted ?? 0,
    playRounds: usage?.playRounds ?? 0,
    activeDays: usage?.activeDays ?? 0,
  };
  const base = { enabled: config.enabled, usage: counts, freeActivitiesPerDay: config.freeActivitiesPerDay, premiumGames: config.premiumGames, plan: config.plan, usageReady: true };
  if (!config.enabled) {
    return { ...base, status: 'open', full: true, canSubscribe: false, exploreEndsAt: null, activitiesLeftToday: null, premiumUntil: null };
  }

  const premiumUntil = usage?.premiumUntil ?? null;
  const paid = premiumUntil !== null && new Date(premiumUntil).getTime() > now.getTime();
  if (paid || config.premiumParentIds.includes(parentId)) {
    return { ...base, status: 'premium', full: true, canSubscribe: true, exploreEndsAt: null, activitiesLeftToday: null, premiumUntil };
  }

  const started = usage?.exploreStartedAt ? new Date(usage.exploreStartedAt) : now;
  const endsAt = new Date(started.getTime() + config.exploreDays * 24 * 60 * 60_000);
  const engaged = counts.activitiesCompleted >= config.inviteAfterActivities || counts.activeDays >= config.inviteAfterDays;

  if (now.getTime() < endsAt.getTime()) {
    return { ...base, status: engaged ? 'invited' : 'exploring', full: true, canSubscribe: engaged, exploreEndsAt: endsAt.toISOString(), activitiesLeftToday: null, premiumUntil };
  }

  const startedToday = usage?.usageDate === usageDay(now) ? usage.activitiesStartedToday : 0;
  return {
    ...base, status: 'free', full: false, canSubscribe: true, exploreEndsAt: endsAt.toISOString(),
    activitiesLeftToday: Math.max(0, config.freeActivitiesPerDay - startedToday), premiumUntil,
  };
}
