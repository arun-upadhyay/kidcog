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
    if (path === '/api/feedback') return route.fulfill({ status: 201, json: { ok: true, emailed: true } });
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

test('new learning games finish rounds, save rewards, replay and exit', async ({ page }) => {
  await games(page);
  for (const name of ['Letter Garden', 'Counting Picnic', 'Number Trail']) {
    await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
    for (let round = 0; round < 5; round++) {
      const choices = page.getByRole('button', { name: /^Answer / });
      let answer: string;
      if (name === 'Letter Garden') {
        const prompt = await page.getByText(/^Find the letter/).first().innerText();
        answer = prompt.match(/letter ([A-Z])/)! [1]!;
      } else if (name === 'Counting Picnic') {
        answer = String(await page.getByRole('button', { name: /^Count fruit / }).count());
      } else {
        const text = await page.getByText(/ → /).first().innerText();
        const sequence = text.split(' → '); const gap = sequence.indexOf('?');
        answer = String(Number(sequence[0]) + gap);
      }
      if (round === 0) {
        for (const choice of await choices.all()) {
          if (await choice.getAttribute('aria-label') !== `Answer ${answer}`) { await choice.click(); break; }
        }
        await expect(page.getByText('Good try! Look again and choose another.')).toBeVisible();
      }
      await page.getByRole('button', { name: `Answer ${answer}`, exact: true }).click();
      if (round < 4) await page.getByRole('button', { name: 'Next round →', exact: true }).click();
    }
    await expect(page.getByText('You did it!', { exact: true })).toBeVisible();
    const key = { 'Letter Garden': 'letter-garden', 'Counting Picnic': 'counting-picnic', 'Number Trail': 'number-trail' }[name]!;
    await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem('kidcog.progress.v1.e2e-child')!).arcade?.[k]?.plays, key)).toBe(1);
    await page.getByRole('button', { name: 'Play again ↻', exact: true }).click();
    await expect(page.getByText('Round 1 of 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to the Play Zone', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Play Number Pairs', exact: true }).click();
  const pairs: Record<string, number[]> = {};
  const cards = page.getByRole('button', { name: /^Hidden card |^[1-6]( dots)?$/ });
  for (let i = 0; i < 6; i += 2) {
    for (const index of [i, i + 1]) {
      await cards.nth(index).click();
      const value = (await cards.nth(index).getAttribute('aria-label'))!.split(' ')[0]!;
      (pairs[value] ??= []).push(index);
    }
    await page.waitForTimeout(1100);
  }
  for (const indexes of Object.values(pairs)) {
    for (const index of indexes) if (!(await cards.nth(index).isDisabled())) await cards.nth(index).click();
  }
  await expect(page.getByText('You did it!', { exact: true })).toBeVisible();
  await page.screenshot({ path: `/private/tmp/kidcog-games/${test.info().project.name}-learning.png`, fullPage: true });
});
