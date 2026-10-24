import { test, expect, type Page } from '@playwright/test';

/**
 * Explore first, subscribe later (src/subscription, server/src/entitlement.ts).
 * The server's answer is mocked for each stage: switched off, exploring,
 * invited, and the free plan after exploring.
 */
const child = { id: 'e2e-child', nickname: 'Test Explorer', age: 5, avatar: 'bear', createdAt: '2026-01-01' };
const categories = [{ key: 'abstract_concepts', label: 'Big ideas', group: 'intellectual', blurb: 'Test activity', measurable: 'direct' }];
const plan = { name: 'KidCog Plus · Early supporter', price: '$1 a month' };
const base = { usage: { activitiesCompleted: 6, playRounds: 9, activeDays: 2 }, exploreEndsAt: '2026-11-07T00:00:00.000Z', activitiesLeftToday: null, freeActivitiesPerDay: 3, premiumGames: ['animals', 'states', 'art-music'], premiumUntil: null, plan };
const STAGES = {
  off: { ...base, enabled: false, status: 'open', full: true, canSubscribe: false },
  exploring: { ...base, enabled: true, status: 'exploring', full: true, canSubscribe: false, usage: { activitiesCompleted: 1, playRounds: 2, activeDays: 1 } },
  invited: { ...base, enabled: true, status: 'invited', full: true, canSubscribe: true },
  free: { ...base, enabled: true, status: 'free', full: false, canSubscribe: true, activitiesLeftToday: 0 },
  // The app thinks one is left, but the server says no (another device used it): the server wins.
  freeStale: { ...base, enabled: true, status: 'free', full: false, canSubscribe: true, activitiesLeftToday: 1 },
};

async function open(page: Page, stage: keyof typeof STAGES, errors: string[], calls: string[] = []) {
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify({ access_token: 'test-only', refresh_token: 'test-only', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: { id: 'test-parent', email: 'tester@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, last_sign_in_at: new Date().toISOString() } }));
    localStorage.setItem('kidcog.aboutSeen.v1', '1');
  });
  await page.route('**/auth/v1/**', route => route.fulfill({ json: { id: 'test-parent', app_metadata: {}, user_metadata: {} } }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    if (path === '/api/speak') return route.fulfill({ path: 'assets/sounds/pop.wav', contentType: 'audio/wav' });
    if (path === '/api/entitlement' || path === '/api/usage/play') return route.fulfill({ json: STAGES[stage] });
    if (path === '/api/children') return route.fulfill({ json: route.request().method() === 'POST' ? child : [child] });
    if (path === '/api/categories') return route.fulfill({ json: categories });
    if (path === '/api/test') return route.fulfill({ status: 402, json: { error: 'That’s all the thinking activities for today on the free plan.', code: 'plan_required', entitlement: STAGES[stage] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  await expect(page.getByRole('radio', { name: 'Test Explorer, age 5' })).toBeVisible();
}
async function toPlayZone(page: Page) {
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch', { name: /parent or guardian/ }).click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await page.getByRole('button', { name: 'Open the Play Zone games' }).click();
}
async function passGate(page: Page) {
  const question = await page.getByTestId('gate-question').textContent();
  const [, a, b] = question!.match(/(\d+) × (\d+)/)!;
  await page.getByLabel('Answer', { exact: true }).fill('1'); // wrong first: a new sum appears
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Not quite — here’s another one.')).toBeVisible();
  const next = await page.getByTestId('gate-question').textContent();
  const [, c, d] = next!.match(/(\d+) × (\d+)/)!;
  expect(Number(a) * Number(b)).toBeGreaterThan(1);
  await page.getByLabel('Answer', { exact: true }).fill(String(Number(c) * Number(d)));
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('switched off: no invite, no plan in the menu, every game opens', async ({ page }) => {
  const errors: string[] = [];
  await open(page, 'off', errors);
  await expect(page.getByTestId('invite-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open parent account menu' }).click();
  await expect(page.getByText('About KidCog')).toBeVisible();
  await expect(page.getByText('KidCog Plus')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close account menu' }).last().click();
  await toPlayZone(page);
  await page.getByRole('button', { name: 'Play USA Map', exact: true }).click();
  await expect(page.getByText('Which state is coloured in?')).toBeVisible();
  expect(errors).toEqual([]);
});

test('exploring: everything open and nothing to buy yet', async ({ page }) => {
  const errors: string[] = [];
  await open(page, 'exploring', errors);
  await expect(page.getByTestId('invite-card')).toHaveCount(0);
  await toPlayZone(page);
  await expect(page.getByRole('button', { name: 'Play USA Map', exact: true })).toBeVisible();
  await expect(page.getByText('Ask a grown-up to open this one')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('invited: the parent sees the invite, passes the gate, and sees the $1 early-supporter plan', async ({ page }, info) => {
  const errors: string[] = [];
  await open(page, 'invited', errors);
  const invite = page.getByTestId('invite-card');
  await expect(invite).toBeVisible();
  await expect(invite).toContainText('You’ve finished 6 thinking activities and 9 Play Zone games.');
  await expect(invite).toContainText('$1 a month');
  await invite.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('invite.png') });
  await page.getByRole('button', { name: 'See the early-supporter plan' }).click();
  await expect(page.getByText('Please answer to continue')).toBeVisible();
  await passGate(page);
  await expect(page.getByText('⭐ KidCog Plus · Early supporter')).toBeVisible();
  await expect(page.getByText('$1 a month', { exact: true })).toBeVisible();
  await expect(page.getByText('Early-supporter sign-up opens soon. Thank you for your patience!')).toBeVisible();
  await page.screenshot({ path: info.outputPath('plans.png') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  // "Not now" hides the invite on this device.
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(invite).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Test Explorer, age 5' })).toBeVisible();
  await expect(page.getByTestId('invite-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('free plan: Plus games and used-up activities ask for a grown-up, never show a price to the child', async ({ page }, info) => {
  const errors: string[] = [];
  await open(page, 'free', errors);
  await toPlayZone(page);
  const map = page.getByRole('button', { name: 'USA Map, ask a grown-up', exact: true });
  await expect(map).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Number Snake', exact: true })).toBeVisible();
  await map.click();
  await expect(page.getByText('Ask a grown-up! 🦉')).toBeVisible();
  await expect(page.getByText('$1 a month')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('ask-grown-up.png') });
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByText('Ask a grown-up! 🦉')).toHaveCount(0);

  // A thinking activity when today's free ones are used up.
  await page.getByRole('button', { name: '← Activities' }).click();
  await page.getByRole('button', { name: /^Big ideas/ }).click();
  await page.getByRole('button', { name: /Let’s play/ }).click();
  await expect(page.getByText('Ask a grown-up! 🦉')).toBeVisible();
  await expect(page.getByText('That’s all the thinking games for today.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'I’m a grown-up' }).click();
  await passGate(page);
  await expect(page.getByText('You’re on the free plan', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('free plan: when the server refuses a round, the activity pop-up closes and Owl asks for a grown-up', async ({ page }) => {
  const errors: string[] = [];
  const calls: string[] = [];
  await open(page, 'freeStale', errors, calls);
  await toPlayZone(page);
  await page.getByRole('button', { name: '← Activities' }).click();
  await page.getByRole('button', { name: /^Big ideas/ }).click();
  await page.getByRole('button', { name: /Let’s play/ }).click();
  await expect(page.getByText('Ask a grown-up! 🦉')).toBeVisible();
  await expect(page.getByRole('button', { name: /Let’s play|Try again/ })).toHaveCount(0);
  expect(calls).toContain('/api/test');
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByText('Ask a grown-up! 🦉')).toHaveCount(0);
  expect(errors).toEqual([]);
});
