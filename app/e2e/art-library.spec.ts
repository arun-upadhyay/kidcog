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
  await expect(page.getByRole('button', { name: /^Colour / })).toHaveCount(PAGES.filter(p => p.group === 'people').length);
  await page.getByRole('tab', { name: /Space/ }).click();
  await expect(page.getByRole('button', { name: 'Colour Rocket', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /ABC/ }).click();
  await page.getByRole('button', { name: 'Colour A is for Apple', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a colour' }).click();
  await page.getByRole('radio', { name: 'Crayon blue' }).click();
  // Move the mouse off the tools so the crayons tuck away before using the picture.
  await page.mouse.move(2, 2);
  await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  const apple = PAGES.find(p => p.key === 'apple')!;
  const canvasEl = page.getByTestId('coloring-canvas');
  await canvasEl.scrollIntoViewIfNeeded();
  const canvas = (await canvasEl.boundingBox())!;
  const [x, y] = apple.parts[0]!.at;
  await canvasEl.click({ position: { x: (x / 100) * canvas.width, y: (y / 100) * canvas.height } });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kidcog.coloring.v1.e2e-child') ?? '{}').apple?.[0])).toBe('#3E7EE0');
  await page.getByRole('button', { name: 'Surprise me!' }).click();
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

test('Rainbow Tracing: tools sit beside the canvas, thick ink, and stars fall when a shape is traced', async ({ page }, info) => {
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Rainbow Tracing', exact: true }).click();
  await page.getByRole('button', { name: 'Choose what to trace', exact: true }).click();
  await page.getByRole('button', { name: 'Star', exact: true }).click();
  await page.mouse.move(2,2);await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  const canvas = page.getByTestId('art-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  // The tools are right next to the canvas: no scrolling needed to reach them.
  for (const name of ['Thin brush', 'Thick brush', 'Eraser', 'Undo', 'Start over', 'Save picture', 'Load saved picture']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport();
  }
  const star = Array.from({ length: 11 }, (_, i) => { const a = (i * 36 - 90) * Math.PI / 180; const r = i % 2 ? 18 : 39; return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]; });
  const at = ([x, y]: number[]) => [box.x + (x! / 100) * box.width, box.y + (y! / 100) * box.height] as const;
  await page.mouse.move(...at(star[0]!));
  await page.mouse.down();
  for (const p of star.slice(1)) await page.mouse.move(...at(p), { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText('⭐ Great tracing! You traced Star!')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath('tracing.png') });
});

test('Alphabet Paint paints, erases, undoes, redoes and reopens saved artwork', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Alphabet Paint', exact: true }).click();
  const canvas = page.getByTestId('alphabet-canvas');
  const storageKey = 'kidcog.art.v1.e2e-child.alphabet.rainy-unicorn';
  await expect(page.getByText('Your picture saves automatically.')).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  let box = (await canvas.boundingBox())!;
  const at = (x: number, y: number): [number, number] => [box.x+x/120*box.width,box.y+y/90*box.height];
  await canvas.click({position:{x:85/120*box.width,y:28/90*box.height}});
  await expect(page.getByTestId('paint-region-16')).toHaveAttribute('fill','#EF4E43');
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey);
  await expect.poll(async () => (await saved()).fills?.[16]).toBe('#EF4E43');
  await page.getByRole('button', {name:'Brush',exact:true}).click();
  await page.mouse.move(2,2);await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  await canvas.scrollIntoViewIfNeeded(); box=(await canvas.boundingBox())!;
  await page.mouse.move(...at(6,48));await page.mouse.down();await page.mouse.move(...at(19,48),{steps:12});await page.mouse.up();
  await expect.poll(async () => (await saved()).strokes?.length).toBe(1);
  await page.getByRole('button',{name:'Eraser',exact:true}).click();
  await page.mouse.move(2,2);await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  await canvas.scrollIntoViewIfNeeded();box=(await canvas.boundingBox())!;
  await page.mouse.move(...at(12,45));await page.mouse.down();await page.mouse.move(...at(12,51),{steps:10});await page.mouse.up();
  await expect.poll(async () => (await saved()).strokes?.[1]?.erase).toBe(true);
  await expect(canvas.getByTestId('paint-ink-stroke')).toHaveAttribute('mask',/url/);
  await expect(page.getByTestId('paint-region-16')).toHaveAttribute('fill','#EF4E43');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(async () => (await saved()).strokes?.length).toBe(1);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect.poll(async () => (await saved()).strokes?.length).toBe(2);
  await page.getByRole('button',{name:'Pictures',exact:true}).click();
  await page.getByRole('button',{name:'Paint A is for Apple',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pick a picture',exact:true})).toBeHidden();
  await expect(page.getByText('Your picture saves automatically.')).toBeVisible();
  await expect(page.getByTestId('paint-region-0')).toHaveAttribute('fill','#FFFFFF');
  await page.getByRole('button',{name:'Pictures',exact:true}).click();
  await page.getByRole('button',{name:'Paint Unicorn & Umbrella',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pick a picture',exact:true})).toBeHidden();
  await expect(page.getByTestId('paint-region-16')).toHaveAttribute('fill','#EF4E43');
  await expect(canvas.getByTestId('paint-ink-stroke')).toHaveAttribute('mask',/url/);
  await page.getByRole('button',{name:'Start over',exact:true}).click();
  await page.getByRole('button',{name:'Keep drawing',exact:true}).click();
  await expect(page.getByText('Start a fresh picture?',{exact:true})).toBeHidden();
  await expect(page.getByTestId('paint-region-16')).toHaveAttribute('fill','#EF4E43');
  await page.getByRole('button',{name:'Back to Art & Music',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'/private/tmp/alphabet-studio-'+test.info().project.name+'.png'});
  const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('Coloring Book: character pages can be scribbled on in Draw mode', async ({ page }) => {
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Coloring Book', exact: true }).click();
  // "People" is the default group; it holds the character pages.
  await page.getByRole('button', { name: 'Colour Superhero', exact: true }).click();
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.getByRole('radio', { name: 'Crayon red' }).click();
  // Move the mouse off the tools so the crayons tuck away before using the picture.
  await page.mouse.move(2, 2);
  await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  const drawCanvas = page.getByTestId('coloring-canvas');
  await drawCanvas.scrollIntoViewIfNeeded();
  const c = (await drawCanvas.boundingBox())!;
  await page.mouse.move(c.x + c.width * 0.3, c.y + c.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width * 0.6, c.y + c.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('kidcog.coloring.draw.v1.e2e-child') ?? '{}').hero ?? []).length)).toBeGreaterThan(0);
});

test('Coloring Book: the rainbow picker fills with a custom colour', async ({ page }) => {
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Coloring Book', exact: true }).click();
  await page.getByRole('tab', { name: /ABC/ }).click();
  await page.getByRole('button', { name: 'Colour A is for Apple', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a colour' }).click();
  await page.getByRole('button', { name: 'More colours', exact: true }).click();
  const shade = page.getByRole('button', { name: /^Colour #/ }).nth(20);
  const hex = (await shade.getAttribute('aria-label'))!.replace('Colour ', '').toLowerCase();
  await shade.click();
  // The picker closes; the chosen colour is now the one in hand.
  await expect(page.getByRole('button', { name: /^Colour #/ })).toHaveCount(0);
  await page.mouse.move(2, 2);
  const canvasEl = page.getByTestId('coloring-canvas');
  await canvasEl.scrollIntoViewIfNeeded();
  const box = (await canvasEl.boundingBox())!;
  const apple = PAGES.find(p => p.key === 'apple')!;
  const [x, y] = apple.parts[0]!.at;
  await canvasEl.click({ position: { x: (x / 100) * box.width, y: (y / 100) * box.height } });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kidcog.coloring.v1.e2e-child') ?? '{}').apple?.[0]?.toLowerCase())).toBe(hex);
});


test('Touch drawing keeps the coloring canvas stationary and saves the stroke', async ({ page, context }, info) => {
  test.skip(!info.project.use.isMobile, 'Real touch gesture regression');
  await artMusic(page);
  await page.getByRole('button', { name: 'Open Coloring Book', exact: true }).click();
  await page.getByRole('button', { name: 'Colour Superhero', exact: true }).click();
  // With a finger: tapping a tool slides the crayons out; picking one tucks them away again.
  await page.getByRole('button', { name: 'Pencil', exact: true }).tap();
  await page.getByRole('radio', { name: 'Crayon green' }).tap();
  await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  const canvas = page.getByTestId('coloring-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveCSS('touch-action', 'none');
  const box = (await canvas.boundingBox())!;
  const client = await context.newCDPSession(page);
  const x = box.x + box.width * .5;
  const startY = box.y + box.height * .65;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let i = 1; i <= 10; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - i * 8 }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(Math.abs((await canvas.boundingBox())!.y - box.y)).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('kidcog.coloring.draw.v1.e2e-child') ?? '{}').hero ?? []).some((stroke: { points: unknown[] }) => stroke.points.length > 3))).toBe(true);
  await client.detach();
});
