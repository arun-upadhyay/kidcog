import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEntitlement, entitlementConfig, usageDay, type Usage } from './entitlement.js';

const config = entitlementConfig({ SUBSCRIPTIONS_ENABLED: '1' });
const now = new Date('2026-10-24T15:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const usage = (over: Partial<Usage> = {}): Usage => ({ exploreStartedAt: daysAgo(1), activitiesCompleted: 0, playRounds: 0, activeDays: 1, usageDate: null, activitiesStartedToday: 0, premiumUntil: null, ...over });

test('switched off by default: every account is open with nothing to buy', () => {
  const off = entitlementConfig({});
  assert.equal(off.enabled, false);
  const e = computeEntitlement('p', usage({ exploreStartedAt: daysAgo(100), activitiesCompleted: 50 }), off, now);
  assert.equal(e.status, 'open'); assert.equal(e.full, true); assert.equal(e.canSubscribe, false); assert.equal(e.activitiesLeftToday, null);
});

test('defaults match .env.example', () => {
  assert.deepEqual({ ...config, enabled: undefined }, { enabled: undefined, exploreDays: 14, inviteAfterActivities: 5, inviteAfterDays: 3, freeActivitiesPerDay: 3, premiumGames: ['animals', 'states', 'art-music'], premiumParentIds: [], plan: { name: 'KidCog Plus · Early supporter', price: '$1 a month' } });
  assert.deepEqual(entitlementConfig({ PREMIUM_GAMES: '' }).premiumGames, []);
  assert.equal(entitlementConfig({ EXPLORE_DAYS: 'nonsense' }).exploreDays, 14);
});

test('a new family explores with everything open and no invite', () => {
  for (const u of [null, usage()]) {
    const e = computeEntitlement('p', u, config, now);
    assert.equal(e.status, 'exploring'); assert.equal(e.full, true); assert.equal(e.canSubscribe, false);
  }
});

test('the invite appears after 5 finished activities or 3 different days, whichever comes first', () => {
  assert.equal(computeEntitlement('p', usage({ activitiesCompleted: 4, activeDays: 2 }), config, now).status, 'exploring');
  for (const u of [usage({ activitiesCompleted: 5 }), usage({ activeDays: 3 })]) {
    const e = computeEntitlement('p', u, config, now);
    assert.equal(e.status, 'invited'); assert.equal(e.full, true); assert.equal(e.canSubscribe, true);
  }
});

test('after the explore period: free tier with a daily allowance that resets each day', () => {
  const ended = computeEntitlement('p', usage({ exploreStartedAt: daysAgo(15) }), config, now);
  assert.equal(ended.status, 'free'); assert.equal(ended.full, false); assert.equal(ended.canSubscribe, true); assert.equal(ended.activitiesLeftToday, 3);
  assert.equal(computeEntitlement('p', usage({ exploreStartedAt: daysAgo(15), usageDate: usageDay(now), activitiesStartedToday: 2 }), config, now).activitiesLeftToday, 1);
  assert.equal(computeEntitlement('p', usage({ exploreStartedAt: daysAgo(15), usageDate: usageDay(now), activitiesStartedToday: 9 }), config, now).activitiesLeftToday, 0);
  assert.equal(computeEntitlement('p', usage({ exploreStartedAt: daysAgo(15), usageDate: '2026-10-23', activitiesStartedToday: 9 }), config, now).activitiesLeftToday, 3);
});

test('KidCog Plus unlocks everything until it expires; hand-given Plus too', () => {
  const later = new Date(now.getTime() + 86_400_000).toISOString();
  assert.equal(computeEntitlement('p', usage({ exploreStartedAt: daysAgo(40), premiumUntil: later }), config, now).status, 'premium');
  assert.equal(computeEntitlement('p', usage({ exploreStartedAt: daysAgo(40), premiumUntil: daysAgo(1) }), config, now).status, 'free');
  const gift = entitlementConfig({ SUBSCRIPTIONS_ENABLED: '1', PREMIUM_PARENT_IDS: 'a, b' });
  assert.equal(computeEntitlement('b', usage({ exploreStartedAt: daysAgo(40) }), gift, now).status, 'premium');
});
