/**
 * Explore first, subscribe later — the app side. The server decides
 * (server/src/entitlement.ts); this file only mirrors the shape it sends.
 * Keep the two in step.
 */
export type EntitlementStatus = 'open' | 'exploring' | 'invited' | 'free' | 'premium';

export type Entitlement = {
  /** SUBSCRIPTIONS_ENABLED on the server. Off: nothing about plans is ever shown. */
  enabled: boolean;
  status: EntitlementStatus;
  /** Everything unlocked right now. */
  full: boolean;
  /** Show the parent the invite card and the KidCog Plus entry in the ☰ menu. */
  canSubscribe: boolean;
  usage: { activitiesCompleted: number; playRounds: number; activeDays: number };
  exploreEndsAt: string | null;
  activitiesLeftToday: number | null;
  freeActivitiesPerDay: number;
  premiumGames: string[];
  premiumUntil: string | null;
  plan: { name: string; price: string };
  /** False while the server can't read usage yet: everything stays open. */
  usageReady?: boolean;
};

/** Used before the server answers, or if it can't be reached: never lock a child out. */
export const OPEN: Entitlement = {
  enabled: false, status: 'open', full: true, canSubscribe: false,
  usage: { activitiesCompleted: 0, playRounds: 0, activeDays: 0 }, exploreEndsAt: null,
  activitiesLeftToday: null, freeActivitiesPerDay: 0, premiumGames: [], premiumUntil: null,
  plan: { name: 'KidCog Plus · Early supporter', price: '$1 a month' },
};

/** Is this Play Zone game locked for this family right now? */
export const gameLocked = (entitlement: Entitlement, game: string) =>
  entitlement.enabled && !entitlement.full && entitlement.premiumGames.includes(game);
