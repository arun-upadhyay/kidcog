import { test, expect, type Page, type Locator } from '@playwright/test';
import { PAGES } from '../src/playzone/coloringPages';
import { guideFor } from '../src/playzone/rainbowContent';
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



async function artMusic(page: Page) {
  await games(page);
  await page.getByRole('button', { name: 'Open Art & Music', exact: true }).click();
}

test('Coloring Book: pick a picture, colour it, and it is saved on the shelf', async ({ page }, info) => {
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Coloring Book', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Colour / })).toHaveCount(PAGES.filter(p => p.group === 'abc').length);
  await page.getByRole('tab', { name: /Space/ }).click();
  await expect(page.getByRole('button', { name: 'Colour Rocket', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /ABC/ }).click();
  await page.getByRole('button', { name: 'Colour A is for Apple', exact: true }).click();
  await page.getByRole('radio', { name: 'Crayon blue' }).click();
  const apple = PAGES.find(p => p.key === 'apple')!;
  const canvas = (await page.getByTestId('coloring-canvas').boundingBox())!;
  const pad = 8 + 3; // canvas padding + border
  const size = canvas.width - pad * 2;
  const [x, y] = apple.parts[0]!.at;
  await page.mouse.click(canvas.x + pad + (x / 100) * size, canvas.y + pad + (y / 100) * size);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kidcog.coloring.v1.e2e-child') ?? '{}').apple?.[0])).toBe('#3E7EE0');
  await page.getByRole('button', { name: '✨ Surprise me!' }).click();
  await expect(page.getByText('✨ Ta-da! A surprise picture!')).toBeVisible();
  await page.screenshot({ path: info.outputPath('coloring.png') });
  await page.getByRole('button', { name: 'Back to the coloring book' }).click();
  await expect(page.getByRole('button', { name: 'Colour A is for Apple', exact: true })).toBeVisible();
});

test('Rainbow Letters: tracing a shape fills the meter and earns a star', async ({ page }, info) => {
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Rainbow Letters', exact: true }).click();
  await page.getByRole('tab', { name: /Shapes/ }).click();
  await expect(page.getByRole('heading', { name: 'Trace Circle' })).toBeVisible();
  const board = (await page.getByTestId('rainbow-board').boundingBox())!;
  const inner = board.width - 8;
  const pts = guideFor('Circle')[0]!;
  await page.mouse.move(board.x + 4 + (pts[0]![0] / 100) * inner, board.y + 4 + (pts[0]![1] / 100) * inner);
  await page.mouse.down();
  for (const [x, y] of pts) await page.mouse.move(board.x + 4 + (x / 100) * inner, board.y + 4 + (y / 100) * inner, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByText('⭐ You traced Circle!')).toBeVisible();
  await page.screenshot({ path: info.outputPath('rainbow.png') });
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await expect(page.getByText('Trace Square')).toBeVisible();
});

test('Calm Bubbles: popping a bubble says its colour', async ({ page }, info) => {
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Calm Bubbles', exact: true }).click();
  await expect(page.getByText('Tap any bubble')).toBeVisible();
  const bubble = page.getByTestId('calm-bubble').first();
  await expect(bubble).toBeVisible();
  const name = (await bubble.getAttribute('aria-label'))!.replace(' bubble', '');
  await bubble.click({ force: true });
  await expect(page.getByText(`${name}!`, { exact: true })).toBeVisible();
  await expect(page.getByText(/bubble(s)? popped/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('calm.png') });
});

test('Music & Movement has the new sing-alongs', async ({ page }) => {
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Music & Movement', exact: true }).click();
  for (const song of ['Zoo Parade', 'Up and Down Opposites', 'Crunchy Veggies', 'Counting Stars', 'Shape Hunt', 'Brush Brush Brush']) {
    await expect(page.getByRole('button', { name: song, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Zoo Parade', exact: true }).click();
  await expect(page.getByText('The lion goes ROAR and shakes his hair.')).toBeVisible();
});
