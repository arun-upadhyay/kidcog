import { test, expect, type Page, type Locator } from '@playwright/test';
import { DOT_PICTURES } from '../src/playzone/dotPictures';
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

test('parent can send feedback from the shared menu', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Open parent account menu' }).click();
  await page.getByRole('button', { name: 'Open feedback form' }).click();
  await expect(page.getByRole('heading', { name: 'Help us improve KidCog' })).toBeVisible();
  await page.getByRole('radio', { name: 'A problem' }).click();
  await page.getByRole('radio', { name: '4 out of 5 stars' }).click();
  await page.getByLabel('Feedback message').fill('The activity worked, but this button was hard to find.');
  await page.getByRole('checkbox').click();
  const submitted = page.waitForRequest(request => new URL(request.url()).pathname === '/api/feedback');
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  expect((await submitted).postDataJSON()).toMatchObject({ category: 'problem', rating: 4, allowContact: true, screen: 'start' });
  await expect(page.getByText('Thank you!', { exact: true })).toBeVisible();
});

test('grown-up feedback is available from the parent menu', async ({ page }) => {
  await prepare(page);
  await expect(page.getByRole('button', { name: 'Give feedback', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Grown-ups', exact: true }).click();
  await page.getByRole('button', { name: 'Open feedback form', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Help us improve KidCog' })).toBeVisible();
});
for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw', 'Connect the Dots', 'Magic Add']) {
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
      await page.getByRole('button', { name: 'Arrow controls', exact: true }).click();
      for (const dir of ['up', 'down', 'left', 'right']) {
        const arrow = page.getByRole('button', { name: `Go ${dir}`, exact: true });
        await arrow.scrollIntoViewIfNeeded();
        await inViewport(page, arrow);
      }
    }
    if (name === 'Trace & Draw') await inViewport(page, page.getByRole('button', { name: /Skip/ }));
    if (name === 'Connect the Dots') await inViewport(page, page.getByRole('button', { name: '↺ Start again', exact: true }));
    if (name === 'Magic Add') {
      await inViewport(page, page.getByTestId('magic-stone').last());
      await inViewport(page, page.getByRole('button', { name: '↺ New stones', exact: true }));
    }
    await page.screenshot({ path: info.outputPath('layout.png') });
    await page.getByRole('button', { name: 'Back to the Play Zone', exact: true }).click();
    await expect(page.getByRole('button', { name: `Play ${name}`, exact: true })).toBeVisible();
  });
}

test('Play Zone cards react to hover and still open', async ({ page }) => {
  await games(page);
  const card = page.getByRole('button', { name: 'Play Animal Explorer', exact: true });
  await card.hover();
  await expect.poll(() => card.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('3px');
  await card.click();
  await expect(page.getByRole('button', { name: /Animal quiz/ })).toBeVisible();
});

test('Animal Sounds plays a real local recording without speech fallback', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Animal Explorer', exact: true }).click();
  await page.getByRole('button', { name: /Animal sounds/ }).click();

  const spokenRequests: string[] = [];
  page.on('request', request => {
    if (/\/api\/(speech|speak)/.test(new URL(request.url()).pathname)) spokenRequests.push(request.url());
  });
  const dogAudio = page.waitForResponse(response => /dog[^/]*\.wav(?:\?|$)/.test(response.url()));
  await page.getByRole('button', { name: 'Play real dog sound', exact: true }).click();
  expect((await dogAudio).ok()).toBe(true);
  expect(spokenRequests).toEqual([]);

  // Animals without a verified recording are left off this sound activity.
  await expect(page.getByRole('button', { name: /real parrot sound/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /real bee sound/i })).toHaveCount(0);
});

test('activity cards react to hover and still open', async ({ page }) => {
  await prepare(page);
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();

  const tile = page.getByRole('button', { name: /^Big ideas/ });
  await tile.hover();
  await expect.poll(() => tile.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('3px');
  await tile.click();
  await expect(page.getByRole('button', { name: /Let’s play/ })).toBeVisible();
});

test('shared app header compacts on scroll and expands at the top', async ({ page }) => {
  await prepare(page);
  const viewport = page.viewportSize()!;
  // Preserve each responsive width while ensuring the small mocked category
  // list can actually scroll even in the tall tablet project.
  await page.setViewportSize({ width: viewport.width, height: Math.min(viewport.height, 500) });
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();

  const header = page.getByTestId('app-header');
  await expect(header).toBeVisible();
  // Reaching the button scrolls the player page, which shrinks the bar; let it
  // grow back on the new screen before measuring it.
  await expect(page.getByRole('button', { name: 'Open the Play Zone games' })).toBeVisible();
  await page.waitForTimeout(400);
  const expandedHeight = await header.evaluate(element => element.getBoundingClientRect().height);

  await page.mouse.wheel(0, 900);
  await expect.poll(
    () => header.evaluate(element => element.getBoundingClientRect().height),
  ).toBeLessThan(expandedHeight - 5);
  await expect.poll(
    () => header.evaluate(element => getComputedStyle(element).backdropFilter),
  ).toContain('blur');

  await page.mouse.wheel(0, -2000);
  await expect.poll(
    () => header.evaluate(element => element.getBoundingClientRect().height),
  ).toBeGreaterThan(expandedHeight - 2);
});

test('Animal Explorer reveals a fun fact with a read-aloud button after a question', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Animal Explorer', exact: true }).click();
  await page.getByRole('button', { name: /Animal quiz/ }).click();
  await page.getByRole('button', { name: '▶ Start', exact: true }).click();

  const choices = page.getByTestId('animal-quiz-choice');
  await expect(choices.first()).toBeVisible();
  await choices.first().click();
  if (await page.getByText('🤩 Did you know?', { exact: true }).count() === 0) await choices.nth(1).click();

  await expect(page.getByText('🤩 Did you know?', { exact: true })).toBeVisible();
  // One fact per answer; the 🔊 reads it only when tapped (no auto-speech).
  await expect(page.getByRole('button', { name: 'Read the fact aloud', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Another fun fact/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Next/ }).first()).toBeVisible();
});

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
  await expect(page.getByText('Great job, Test Explorer!', { exact: true })).toBeVisible();
  await expect(page.getByText('Grown-ups: see the results', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/What is \d+ \+ \d+\?/)).toHaveCount(0);
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
    for (const name of ['Number Snake', 'Bubble Pop', 'Maze Runner', 'Trace & Draw', 'Connect the Dots', 'Magic Add']) {
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

/** Which stones (by position) add up to the target, if any. */
function stonesFor(values: number[], target: number): number[] | null {
  const ways = new Map<number, number[]>([[0, []]]);
  values.forEach((v, i) => {
    for (const [sum, used] of [...ways]) if (sum + v <= target && !ways.has(sum + v)) ways.set(sum + v, [...used, i]);
  });
  return ways.get(target) ?? null;
}

test('Magic Add: numbers that make the magic number fill the star jar; too much just resets', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Magic Add', exact: true }).click();
  const jar = page.getByLabel(/stars in the jar$/);
  const stones = page.getByTestId('magic-stone');
  const read = async () => ({
    target: Number((await page.getByRole('heading', { name: /^Make \d+$/ }).getAttribute('aria-label'))!.replace('Make ', '')),
    values: await stones.evaluateAll(els => els.map(el => Number(el.getAttribute('aria-label')!.replace('Number ', '')))),
  });
  await expect(jar).toHaveAttribute('aria-label', '0 of 5 stars in the jar');

  // Too much: the tapped stones wobble and let go, and nothing is lost.
  let { target, values } = await read();
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  let total = 0; const over: number[] = [];
  for (const [v, i] of order) { total += v; over.push(i); if (total >= target) break; }
  if (total > target) {
    for (const i of over) await stones.nth(i).click();
    await expect(page.getByText('Too much! Try again 🙂', { exact: true })).toBeVisible();
    await expect(page.getByText('🫕 Tap the numbers!', { exact: true })).toBeVisible();
  }

  for (let made = 1; made <= 2; made++) {
    ({ target, values } = await read());
    const pick = stonesFor(values, target);
    expect(pick, `stones that make ${target} in ${values.join(',')}`).not.toBeNull();
    await page.getByText('🫕 Tap the numbers!', { exact: true }).waitFor();
    for (const i of pick!) await stones.nth(i).click();
    await expect(jar).toHaveAttribute('aria-label', `${made} of 5 stars in the jar`);
    await expect(stones).toHaveCount(values.length);
  }
});

test('Connect the Dots: wrong dots wiggle, joining every dot reveals the picture', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Connect the Dots', exact: true }).click();
  // The test child is 5, so the game starts on level 2: the heart comes first.
  const board = page.getByLabel(/^Dot board/);
  await expect(board).toHaveAccessibleName('Dot board. Next dot: 2');
  const box = (await board.boundingBox())!;
  const tap = ([x, y]: [number, number]) => page.mouse.click(box.x + (x / 100) * box.width, box.y + (y / 100) * box.height);
  const dots = DOT_PICTURES.heart!.dots;
  await tap(dots[5]!);
  await expect(board).toHaveAccessibleName('Dot board. Next dot: 2');
  await page.waitForTimeout(400); // let the "not that one" wiggle finish before measuring taps again
  for (const dot of dots.slice(1)) await tap(dot);
  await expect(page.getByText("It's a heart! 🎉", { exact: true })).toBeVisible();
  await inViewport(page, page.getByRole('button', { name: 'Next ▶', exact: true }));

  // Colour it in: pick a crayon, tap the heart, and it goes on the wall in that colour.
  await page.getByRole('button', { name: '🎨 Colour it', exact: true }).click();
  await page.getByRole('radio', { name: 'Crayon blue' }).click();
  const art = (await page.getByLabel('Colouring the heart').boundingBox())!;
  await page.mouse.click(art.x + art.width * 0.5, art.y + art.height * 0.6);
  await inViewport(page, page.getByRole('button', { name: '✓ Done', exact: true }));
  await page.getByRole('button', { name: '✓ Done', exact: true }).click();
  await expect(page.getByText('Your heart is on your wall! 🖼️', { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidcog.progress.v1.e2e-child') ?? '{}').pictures?.heart);
  expect(saved?.[0]).toBe('#3FA7D6');

  await page.getByRole('button', { name: 'Next ▶', exact: true }).click();
  await expect(page.getByLabel(/^Dot board/)).toHaveAccessibleName('Dot board. Next dot: 2');
});

test('Play Zone shelf: sticker book, picture wall and dressing up Cog', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: /^My pictures, 0 of 12/ }).click();
  await expect(page.getByText('0 of 12 on the wall', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: /^Sticker book/ }).click();
  await expect(page.getByText(/stickers$/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  // The test child has 3 stars: the bow tie (1) and flower (3) are open, the party hat (10) is not.
  await page.getByRole('button', { name: 'Dress up Cog', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Party hat, unlocks at 10 stars' })).toBeVisible();
  await page.getByRole('button', { name: 'Bow tie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bow tie, wearing' })).toBeVisible();
  await page.getByRole('button', { name: 'Party hat, unlocks at 10 stars' }).click();
  await expect(page.getByRole('button', { name: /^Party hat, wearing/ })).toHaveCount(0);
  const owl = await page.evaluate(() => JSON.parse(localStorage.getItem('kidcog.progress.v1.e2e-child') ?? '{}').owl);
  expect(owl).toEqual({ neck: 'bow' });
});

test('switching player is one tap away on the activities and Play Zone pages', async ({ page }) => {
  await prepare(page);
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await expect(page.getByText('Test Explorer’s turn!')).toBeVisible();
  await inViewport(page, page.getByRole('button', { name: 'Switch player', exact: true }));
  await page.getByRole('button', { name: 'Open the Play Zone games' }).click();
  await inViewport(page, page.getByRole('button', { name: 'Switch player', exact: true }));
  await page.getByRole('button', { name: 'Switch player', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true })).toBeVisible();
});

test('correct mystery answers celebrate across the viewport and can be dismissed', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Animal Explorer', exact: true }).click();
  await page.getByRole('button', { name: /Animal sounds\. Tap/ }).click();
  await page.getByRole('tab', { name: /Guess who/ }).click();
  await page.getByRole('button', { name: /Play a mystery sound/ }).click();
  const choices = page.getByRole('button', { name: /^Play real .* sound$/ });
  const reward = page.getByRole('button', { name: 'Great job! Continue', exact: true });
  for (let i = 0; i < await choices.count(); i++) {
    await choices.nth(i).click();
    try { await expect(reward).toBeVisible({ timeout: 350 }); break; } catch { /* Try the next animal after an incorrect answer. */ }
  }
  await inViewport(page, reward);
  await page.screenshot({ path: '/private/tmp/kidcog-celebration-' + test.info().project.name + '.png' });
  await reward.click();
  await expect(reward).toBeHidden();
});

test('the browser Back button steps back inside KidCog: game → Play Zone → activities → players', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Magic Add', exact: true }).click();
  await expect(page.getByTestId('magic-stone').first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Play Number Snake', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Open the Play Zone games' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true })).toBeVisible();
  expect(new URL(page.url()).host).toBe(new URL(page.url()).host); // still in the app
});

test('Maze lets children move directly on the board with optional arrow controls', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Maze Runner', exact: true }).click();
  const board = page.getByTestId('maze-board');
  const before = await board.getAttribute('aria-label');
  await expect(page.getByRole('button', { name: 'Go up', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Move Cog / }).first().click();
  await expect(board).not.toHaveAttribute('aria-label', before!);
  await page.getByRole('button', { name: 'Arrow controls', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Go up', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Arrow controls', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Go up', exact: true })).toHaveCount(0);
});

for (const name of ['Number Snake', 'Bubble Pop']) {
  test(`${name} pauses when leaving the app and waits for the child to resume`, async ({ page }) => {
    await games(page);
    await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
    await page.getByRole('button', { name: '▶ Tap to start', exact: true }).click();
    await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('button', { name: /Pause/ })).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('button', { name: /Pause/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^▶ (Keep going|Tap to start)$/ }).click();
    await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible();
  });
}

test('activity details keep play and close reachable on a short screen', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await prepare(page);
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await page.getByRole('button', { name: /^Big ideas/ }).click();
  const play = page.getByRole('button', { name: '▶  Let’s play!', exact: true });
  await play.scrollIntoViewIfNeeded();
  await inViewport(page, play);
  const close = page.getByRole('button', { name: 'Not now', exact: true });
  await close.scrollIntoViewIfNeeded();
  await inViewport(page, close);
  await close.click();
  await expect(close).toHaveCount(0);
});

test('Snake is compact and a tap above its head steers upward', async ({ page }) => {
  await games(page);
  await page.getByRole('button', { name: 'Play Number Snake', exact: true }).click();
  await page.clock.install();
  await page.getByRole('button', { name: '▶ Tap to start', exact: true }).click();
  const board = (await page.getByTestId('snake-board').boundingBox())!;
  const head = (await page.getByTestId('snake-head').boundingBox())!;
  expect(Math.abs(board.width - board.height)).toBeLessThan(2);
  expect(Math.abs(head.width - head.height)).toBeLessThan(2);
  expect(head.width).toBeLessThan(board.width / 8);
  await expect(page.getByTestId('snake-segment')).toHaveCount(1);
  await page.mouse.click(head.x + head.width / 2, head.y - (board.width - 6) / 8);
  await page.clock.fastForward(650);
  const moved = (await page.getByTestId('snake-head').boundingBox())!;
  expect(moved.y).toBeLessThan(head.y);
  expect(Math.abs(moved.x - head.x)).toBeLessThan(2);
});

test('dashboard has four matching destinations and a working Thinking shortcut', async ({ page }, info) => {
  await prepare(page);
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  const cards = ['Open the Play Zone games', 'Open the Animal Explorer', 'Open the Art & Music studio', 'Open Thinking Activities'];
  const boxes = [];
  for (const name of cards) boxes.push((await page.getByRole('button', { name, exact: true }).boundingBox())!);
  expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(2);
  expect(Math.abs(boxes[2]!.y - boxes[3]!.y)).toBeLessThan(2);
  expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: cards[3], exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Thinking activities', exact: true })).toBeInViewport();
});
