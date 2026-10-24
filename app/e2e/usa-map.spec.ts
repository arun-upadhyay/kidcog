import { test, expect, type Page } from '@playwright/test';
import { STATE_BY_CODE } from '../src/explore/usMapQuiz';

const child = { id: 'e2e-child', nickname: 'Test Explorer', age: 5, avatar: 'bear', createdAt: '2026-01-01' };
const categories = [{ key: 'abstract_concepts', label: 'Big ideas', group: 'intellectual', blurb: 'Test activity', measurable: 'direct' }];

async function openUsaMap(page: Page, errors: string[]) {
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify({ access_token: 'test-only', refresh_token: 'test-only', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: { id: 'test-parent', email: 'tester@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, last_sign_in_at: new Date().toISOString() } }));
    localStorage.setItem('kidcog.aboutSeen.v1', '1');
    localStorage.setItem('kidcog.progress.v1.e2e-child', JSON.stringify({ stars: 3, stickers: [], levels: {}, visited: {} }));
  });
  await page.route('**/auth/v1/**', route => route.fulfill({ json: { id: 'test-parent', app_metadata: {}, user_metadata: {} } }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    // Read-aloud audio: a real short clip, so playback works as it does against the server.
    if (path === '/api/speak') return route.fulfill({ path: 'assets/sounds/pop.wav', contentType: 'audio/wav' });
    if (path === '/api/children') return route.fulfill({ json: [child] });
    if (path === '/api/categories') return route.fulfill({ json: categories });
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await page.getByRole('button', { name: 'Open the Play Zone games' }).click();
  await page.getByRole('button', { name: 'Play USA Map', exact: true }).click();
}

/** The state that is coloured in, read from the map itself (not from the choices). */
async function askedState(page: Page) {
  const fills = await page.locator('[data-testid^="map-state-"]').evaluateAll(paths =>
    paths.map(p => [p.getAttribute('data-testid')!.slice(10), (p.getAttribute('fill') ?? '').toUpperCase()]));
  const lit = fills.filter(([, fill]) => fill === '#FFB703');
  expect(lit).toHaveLength(1);
  return lit[0]![0]!;
}

test('USA Map: a real coloured state, four names, a full round to stars', async ({ page }, info) => {
  const errors: string[] = [];
  await openUsaMap(page, errors);
  await expect(page.getByText('Which state is coloured in?', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="map-state-"]')).toHaveCount(50);
  await page.screenshot({ path: info.outputPath('question.png') });

  for (let i = 0; i < 8; i++) {
    const code = await askedState(page);
    const name = STATE_BY_CODE[code]!.name;
    const choices = page.getByTestId('state-choice');
    await expect(choices).toHaveCount(4);
    const labels = await choices.allTextContents();
    expect(labels).toContain(name);
    expect(new Set(labels).size).toBe(4);
    // Question 1: miss once first, to check the gentle second try.
    if (i === 0) {
      await choices.filter({ hasNotText: new RegExp(`^${name}$`) }).first().click();
      await expect(page.getByText('Not quite. Try again! 💪')).toBeVisible();
    }
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByText(`It's ${name}! 🎉`, { exact: true })).toBeVisible();
    if (i === 0) await page.screenshot({ path: info.outputPath('answered.png') });
    await page.getByRole('button', { name: i === 7 ? 'See my stars ⭐' : 'Next state ▶' }).click();
  }
  await expect(page.getByText('You did it!')).toBeVisible();
  await expect(page.getByText('You named 7 of 8 states on the first try!')).toBeVisible();
  await expect(page.getByLabel('3 stars')).toBeVisible();

  // Explore: tap a state on the map to see its name.
  await page.getByRole('button', { name: 'Play again ↻' }).click();
  await page.getByRole('tab', { name: '👆 Explore the map' }).click();
  await page.getByTestId('map-state-TX').click();
  await expect(page.getByText('Texas', { exact: true })).toBeVisible();
  await expect(page.getByText('The Lone Star State', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('explore.png') });

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
