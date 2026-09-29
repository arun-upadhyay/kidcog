import { test, expect, type Page, type Locator } from '@playwright/test';
const categories = ['abstract_concepts', 'cause_effect'].map(key => ({ key, label: key === 'abstract_concepts' ? 'Big ideas' : 'What happens next?', group: 'intellectual', blurb: 'Test activity', measurable: 'direct' }));
const child = { id: 'e2e-child', nickname: 'Test Explorer', age: 5, avatar: 'bear', createdAt: '2026-01-01' };
async function prepare(page: Page, fail = false) {
  await page.addInitScript(() => {
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify({ access_token: 'test-only', refresh_token: 'test-only', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: { id: 'test-parent', email: 'tester@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, last_sign_in_at: new Date().toISOString() } }));
    localStorage.setItem('kidcog.aboutSeen.v1', '1');
    localStorage.setItem('kidcog.progress.v1.e2e-child', JSON.stringify({ stars: 3, stickers: [], levels: {}, visited: { abstract_concepts: { plays: 3, stars: 3 } } }));
  });
  await page.route('**/auth/v1/**', route => route.fulfill({ json: { id: 'test-parent', app_metadata: {}, user_metadata: {} } }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/children') {
      if (route.request().method() === 'POST') return route.fulfill({ json: child });
      if (fail) { fail = false; return route.fulfill({ status: 429, json: { error: 'Too many requests, slow down.' } }); }
      await new Promise(r => setTimeout(r, 700));
      return route.fulfill({ json: [child] });
    }
    if (path === '/api/categories') return route.fulfill({ json: categories });
    if (path === '/api/test') {
      const input = route.request().postDataJSON();
      return route.fulfill({ json: { sessionId: 'test-session', traits: categories, questionCount: 2, followUpQuestions: {}, remainingUnseen: -1, poolExhausted: false,
        profile: { key: 'early', ageBand: [4,7], uiScale: 1, showScoreToChild: false, showTimer: false, celebrateEachAnswer: false, openAnswerMode: 'text' },
        questions: [1,2].map(i => ({ id: `q${i}`, trait: input.trait, type: 'mcq', prompt: `Test question ${i}`, options: [{ key: 'a', text: 'First answer' }, { key: 'b', text: 'Second answer' }], format: 'sentence_completion', figure: null, visual: null, spoken: null, followUp: null, speechText: `Test question ${i}`, timeLimitSeconds: null })) } });
    }
    if (path === '/api/submit') return route.fulfill({ json: { version: 2, generatedAt: new Date().toISOString(), overall: { earned: 6, possible: 6, percent: 100 },
      traits: categories.map((t,i) => ({ ...t, questionCount: i ? 0 : 2, earned: i ? 0 : 6, possible: i ? 0 : 6, percent: i ? 0 : 100, band: 'Explored', formScale: i ? null : { value: 5, label: 'Observed' }, evidence: 'Test evidence' })), strongest: null, growthArea: null, responses: [], seenQuestionIds: ['q1','q2'], graderFailed: null, disclaimer: 'Test report' } });
    if (path === '/api/prefetch') return route.fulfill({ json: {} });
    return route.fulfill({ status: 500, json: { error: `Unmocked endpoint: ${path}` } });
  });
  await page.goto('/');
}
async function inViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}
async function games(page: Page) {
  await prepare(page);
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await page.getByRole('button', { name: 'Open the Play Zone games' }).click();
}
test('saved players load without flashing the new-child form', async ({ page }) => {
  await prepare(page);
  await expect(page.getByText('Loading your saved players…')).toBeVisible();
  await expect(page.getByPlaceholder('e.g. Aanya')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Test Explorer, age 5' })).toBeVisible();
  if (['desktop', 'phone', 'tablet'].includes(test.info().project.name)) await expect(page).toHaveScreenshot('saved-players.png', { animations: 'disabled' });
  await expect(page.getByPlaceholder('e.g. Aanya')).toHaveCount(0);
});
test('profile failure can be retried without showing an empty form', async ({ page }) => {
  await prepare(page, true);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Test Explorer, age 5' })).toBeVisible();
});
for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw']) {
  test(`${name}: board, controls and return navigation`, async ({ page }, info) => {
    await games(page);
    await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
    if (name === 'Number Snake' || name === 'Bubble Pop') {
      await inViewport(page, page.getByRole('button', { name: '▶ Tap to start', exact: true }));
      await page.getByRole('button', { name: '▶ Tap to start', exact: true }).click();
      await inViewport(page, page.getByRole('button', { name: /Pause/ }));
      await page.getByRole('button', { name: /Pause/ }).click();
    }
    if (name === 'Number Snake' || name === 'Maze Runner') {
      for (const dir of ['up', 'down', 'left', 'right']) await inViewport(page, page.getByRole('button', { name: `Go ${dir}`, exact: true }));
    }
    if (name === 'Trace & Draw') await inViewport(page, page.getByRole('button', { name: /Skip/ }));
    await page.screenshot({ path: info.outputPath('layout.png') });
    await page.getByRole('button', { name: 'Back to the Play Zone', exact: true }).click();
    await expect(page.getByRole('button', { name: `Play ${name}`, exact: true })).toBeVisible();
  });
}

test('answers stay paired with questions and another category starts from results', async ({ page }) => {
  await prepare(page);
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await page.getByRole('button', { name: /^Big ideas/ }).click();
  await page.getByRole('button', { name: /Let’s play/ }).click();
  await expect(page.getByText('Test question 1', { exact: true })).toBeVisible();
  await page.getByLabel('First answer', { exact: true }).click();
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.getByText('Test question 2', { exact: true })).toBeVisible();
  await page.getByLabel('Second answer', { exact: true }).click();
  const submitted = page.waitForRequest(r => new URL(r.url()).pathname === '/api/submit');
  await page.getByRole('button', { name: /finished/ }).click();
  expect((await submitted).postDataJSON().responses.map((r: any) => [r.questionId, r.answer])).toEqual([['q1','a'], ['q2','b']]);
  await page.getByText('Grown-ups: see the results', { exact: true }).click();
  const gate = await page.getByText(/What is \d+ \+ \d+\?/).innerText();
  const numbers = gate.match(/\d+/g)!.map(Number);
  await page.getByText(String(numbers[0]! + numbers[1]!), { exact: true }).click();
  await page.getByText(/See all 2 activities/).click();
  const next = page.waitForRequest(r => new URL(r.url()).pathname === '/api/test');
  await page.getByRole('button', { name: /What happens next.*start activity/ }).click();
  expect((await next).postDataJSON().trait).toBe('cause_effect');
  await expect(page.getByText('Test question 1', { exact: true })).toBeVisible();
});

test('repeated game switching leaves no runtime errors or horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await games(page);
  for (let round = 0; round < 2; round++) {
    for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw']) {
      await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (name === 'Number Snake' || name === 'Bubble Pop') {
        await page.getByRole('button', { name: '▶ Tap to start', exact: true }).click();
        await page.getByRole('button', { name: /Pause/ }).click();
        await page.getByRole('button', { name: /^▶ (Keep going|Tap to start)$/ }).click();
        await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible();
      }
      await page.getByRole('button', { name: 'Back to the Play Zone', exact: true }).click();
    }
  }
  expect(errors).toEqual([]);
});

test('generation failure retries the selected category without duplicate requests', async ({ page }) => {
  await prepare(page);
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await page.getByRole('button', { name: /^Big ideas/ }).click();
  let requests = 0;
  await page.route('**/api/test', async route => {
    requests++;
    expect(route.request().postDataJSON().trait).toBe('abstract_concepts');
    if (requests === 1) return route.fulfill({ status: 503, json: { error: 'Test temporary failure' } });
    return route.fallback();
  });
  await page.getByRole('button', { name: /Let’s play/ }).click();
  await page.getByRole('button', { name: /Try again/ }).click();
  await expect(page.getByText('Test question 1', { exact: true })).toBeVisible();
  expect(requests).toBe(2);
});
