import { test, expect, type Page } from '@playwright/test';
import { PAGES } from '../src/playzone/coloringPages';

/** The coloring studio: tool rail on the right, crayons that slide out on hover and hide again. */
const child = { id: 'e2e-child', nickname: 'Test Explorer', age: 5, avatar: 'bear', createdAt: '2026-01-01' };

async function openApple(page: Page, errors: string[]) {
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify({ access_token: 'test-only', refresh_token: 'test-only', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: { id: 'test-parent', email: 'tester@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, last_sign_in_at: new Date().toISOString() } }));
    localStorage.setItem('kidcog.aboutSeen.v1', '1');
  });
  await page.route('**/auth/v1/**', route => route.fulfill({ json: { id: 'test-parent', app_metadata: {}, user_metadata: {} } }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/speak') return route.fulfill({ path: 'assets/sounds/pop.wav', contentType: 'audio/wav' });
    if (path === '/api/children') return route.fulfill({ json: route.request().method() === 'POST' ? child : [child] });
    if (path === '/api/categories') return route.fulfill({ json: [{ key: 'abstract_concepts', label: 'Big ideas', group: 'intellectual', blurb: 'Test', measurable: 'direct' }] });
    return route.fulfill({ status: 404, json: { error: 'not mocked' } });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true }).click();
  await page.getByRole('switch', { name: /parent or guardian/ }).click();
  await page.getByRole('button', { name: /Choose an adventure/ }).click();
  await page.getByRole('button', { name: 'Open the Play Zone games' }).click();
  await page.getByRole('button', { name: 'Open Art & Music', exact: true }).click();
  await page.getByRole('button', { name: 'Open Coloring Book', exact: true }).click();
  await page.getByRole('tab', { name: /ABC/ }).click();
  await page.getByRole('button', { name: 'Colour A is for Apple', exact: true }).click();
}
const fillOf = (page: Page, i: number) => page.evaluate(n => JSON.parse(localStorage.getItem('kidcog.coloring.v1.e2e-child') ?? '{}').apple?.[n] ?? null, i);
const strokeCount = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('kidcog.coloring.draw.v1.e2e-child') ?? '{}').apple ?? []).length);

test('crayons slide out when the mouse is over the tools and hide when it leaves', async ({ page }, info) => {
  test.skip(!!info.project.use.hasTouch, 'Mouse hover');
  const errors: string[] = [];
  await openApple(page, errors);
  const canvas = page.getByTestId('coloring-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  for (const tool of ['Brush', 'Pencil', 'Marker', 'Paint bucket', 'Eraser']) await expect(page.getByRole('button', { name: tool, exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('studio-closed.png') });

  // Hover the tools: the crayons come out.
  await page.getByRole('button', { name: 'Paint bucket', exact: true }).hover();
  await expect(page.getByTestId('crayon-drawer')).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Crayon / })).toHaveCount(12);
  await page.getByRole('radio', { name: 'Crayon blue' }).hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('studio-open.png') });
  await page.getByRole('radio', { name: 'Crayon blue' }).click();
  await expect(page.getByRole('radio', { name: 'Crayon blue' })).toBeChecked();
  // Still out while the mouse stays over them…
  await page.waitForTimeout(600);
  await expect(page.getByTestId('crayon-drawer')).toBeVisible();
  // …and tucked away once it leaves.
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);

  // Fill with the bucket.
  const apple = PAGES.find(p => p.key === 'apple')!;
  const [x, y] = apple.parts[0]!.at;
  await canvas.click({ position: { x: (x / 100) * box.width, y: (y / 100) * box.height } });
  await expect.poll(() => fillOf(page, 0)).toBe('#3E7EE0');

  // Paint with the brush, then rub it out with the eraser, then undo the rub-out.
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.getByRole('radio', { name: 'Crayon red' }).click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.85, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => strokeCount(page)).toBe(1);
  await page.screenshot({ path: info.outputPath('studio-painted.png') });
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.33, box.y + box.height * 0.9, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => strokeCount(page)).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => strokeCount(page)).toBe(1);
  // Eraser tap on a filled part makes it white again.
  await canvas.click({ position: { x: (x / 100) * box.width, y: (y / 100) * box.height } });
  await expect.poll(() => fillOf(page, 0)).toBe('#FFFFFF');

  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect.poll(() => strokeCount(page)).toBe(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Colour A is for Apple', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('with a finger: the colour chip brings the crayons out and a pick tucks them away; everything fits on screen', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'Touch');
  const errors: string[] = [];
  await openApple(page, errors);
  const viewport = page.viewportSize()!;
  for (const name of ['Brush', 'Pencil', 'Marker', 'Paint bucket', 'Eraser', 'Choose a colour', 'Done', 'Undo', 'Back to the coloring book']) {
    const b = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(b.x + b.width, name).toBeLessThanOrEqual(viewport.width + 1);
    expect(b.x, name).toBeGreaterThanOrEqual(-1);
  }
  await page.getByRole('button', { name: 'Choose a colour', exact: true }).tap();
  await expect(page.getByTestId('crayon-drawer')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('touch-open.png') });
  await page.getByRole('radio', { name: 'Crayon purple' }).tap();
  await expect(page.getByTestId('crayon-drawer')).toHaveCount(0);
  const canvas = page.getByTestId('coloring-canvas');
  const box = (await canvas.boundingBox())!;
  const apple = PAGES.find(p => p.key === 'apple')!;
  const [x, y] = apple.parts[0]!.at;
  await canvas.tap({ position: { x: (x / 100) * box.width, y: (y / 100) * box.height } });
  await expect.poll(() => fillOf(page, 0)).toBe('#8D63D8');
  await page.screenshot({ path: info.outputPath('touch-filled.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
