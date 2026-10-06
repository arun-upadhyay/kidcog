import type { Page } from '@playwright/test';
import { DOT_PICTURES } from '../../src/playzone/dotPictures';
import { CHILD, check, expect, signedIn, signedOut, test } from './support';

/**
 * Walks every screen of the app on every device in devices.ts (one Playwright
 * project per device). Run with:  npm run test:screens
 * Then open the gallery:          npm run test:screens:gallery
 *
 * Each test is one part of the app, so a failure points at the place and the
 * device straight away ("iPhone SE (1st gen) › games › Number Snake …").
 */

async function toActivities(page: Page) {
  await signedIn(page);
  await page.goto('/');
  await page.getByRole('radio', { name: `${CHILD.nickname}, age ${CHILD.age}`, exact: true }).click();
  const consent = page.getByRole('switch');
  if (await consent.count()) await consent.click();
  const go = page.getByRole('button', { name: /Choose an adventure/ });
  if (await go.count()) await go.click();
  await expect(page.getByRole('button', { name: 'Open the Play Zone games' })).toBeVisible();
}

async function toPlayZone(page: Page) {
  await toActivities(page);
  await page.getByRole('button', { name: 'Open the Play Zone games' }).click();
  await expect(page.getByRole('button', { name: 'Play Number Snake', exact: true })).toBeVisible();
}

test('welcome, sign in and sign up', async ({ page, device }) => {
  await signedOut(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready for a little adventure?' })).toBeVisible();
  await check(page, device, 'welcome', [page.getByRole('button', { name: 'Parent sign in', exact: true }).first()]);

  await page.getByRole('button', { name: /^Number Snake/ }).click();
  await expect(page.getByText('Unlock Number Snake', { exact: true })).toBeVisible();
  await check(page, device, 'sign-up (from a game tile)');

  await page.getByRole('button', { name: 'Back to activities' }).click();
  await page.getByRole('button', { name: 'Parent sign in', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();
  await check(page, device, 'sign-in');

  await page.getByText('Create account', { exact: true }).first().click();
  await check(page, device, 'create account');
});

test('privacy page', async ({ page, device }) => {
  await signedOut(page);
  await page.goto('/privacy');
  await expect(page.getByText(/Privacy/).first()).toBeVisible();
  // Only ever shown in a web browser (the apps open it in the browser), which keeps
  // pages clear of the notch itself, so there are no system bars to check here.
  await check(page, { ...device, insets: { top: 0, bottom: 0 } }, 'privacy policy');
});

test('players: first child and saved players', async ({ page, device }) => {
  await signedIn(page, { children: [] });
  await page.goto('/');
  await expect(page.getByPlaceholder('e.g. Aanya')).toBeVisible();
  await check(page, device, 'add your first child');

  await signedIn(page);
  await page.goto('/');
  await expect(page.getByRole('radio', { name: `${CHILD.nickname}, age ${CHILD.age}`, exact: true })).toBeVisible();
  await check(page, device, 'who is playing');

  await page.getByRole('button', { name: 'Open parent account menu' }).click();
  await check(page, device, 'parent menu', [page.getByRole('button', { name: 'Close account menu' }).last()]);
});

test('activities, a round and the results', async ({ page, device }) => {
  await toActivities(page);
  await check(page, device, 'activities');

  await page.getByRole('button', { name: /^Big ideas/ }).click();
  await expect(page.getByRole('button', { name: /Let’s play/ })).toBeVisible();
  await check(page, device, 'activity intro', [page.getByRole('button', { name: /Let’s play/ })]);

  await page.getByRole('button', { name: /Let’s play/ }).click();
  await expect(page.getByText(/What comes next/).first()).toBeVisible();
  await check(page, device, 'question', [page.getByRole('button', { name: /Skip this one|Next/ })]);

  await page.getByLabel('🍌 Banana', { exact: true }).click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByLabel('🚗 Car', { exact: true }).click();
  await check(page, device, 'last question answered', [page.getByRole('button', { name: /finished/ })]);

  await page.getByRole('button', { name: /finished/ }).click();
  await expect(page.getByText(`Great job, ${CHILD.nickname}!`, { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(1200);
  await check(page, device, 'results');
});

test('Play Zone and the collection shelf', async ({ page, device }) => {
  await toPlayZone(page);
  await check(page, device, 'play zone');
  for (const [tile, screen] of [[/^Sticker book/, 'sticker book'], [/^My pictures/, 'my pictures'], [/^Dress up Owl$/, 'dress up owl']] as const) {
    await page.getByRole('button', { name: tile }).click();
    const close = page.getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeVisible();
    await check(page, device, screen);
    await close.click();
  }
});

test('games: boards and controls fit', async ({ page, device }) => {
  await toPlayZone(page);
  const back = () => page.getByRole('button', { name: 'Back to the Play Zone', exact: true }).click();
  const button = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

  await button('Play Number Snake').click();
  await check(page, device, 'Number Snake (start)', [button('▶ Tap to start')]);
  await button('▶ Tap to start').click();
  await check(page, device, 'Number Snake (playing)', ['up', 'down', 'left', 'right'].map(d => button(`Go ${d}`)).concat(button(/Pause/)));
  await button(/Pause/).click();
  await back();

  await button('Play Bubble Pop').click();
  await check(page, device, 'Bubble Pop (start)', [button('▶ Tap to start')]);
  await button('▶ Tap to start').click();
  await check(page, device, 'Bubble Pop (playing)', [button(/Pause/)]);
  await button(/Pause/).click();
  await back();

  await button('Play Maze Runner').click();
  await check(page, device, 'Maze Runner', ['up', 'down', 'left', 'right'].map(d => button(`Go ${d}`)));
  await back();

  await button('Play Trace & Draw').click();
  await check(page, device, 'Trace & Draw', [button(/Skip/)]);
  await back();

  // Connect the Dots: join the heart (a 5-year-old starts on level 2), then colour it.
  await button('Play Connect the Dots').click();
  await check(page, device, 'Connect the Dots', [button('↺ Start again')]);
  const board = page.getByLabel(/^Dot board/);
  const box = (await board.boundingBox())!;
  for (const [x, y] of DOT_PICTURES.heart!.dots.slice(1)) await page.mouse.click(box.x + (x / 100) * box.width, box.y + (y / 100) * box.height);
  await expect(button('🎨 Colour it')).toBeVisible();
  await check(page, device, 'Connect the Dots (finished)', [button('🎨 Colour it'), button('Next ▶')]);
  await button('🎨 Colour it').click();
  await check(page, device, 'Connect the Dots (colouring)', [button('✓ Done'), page.getByRole('radio', { name: 'Crayon red' })]);
  await button('✓ Done').click();
  await back();
});

test('Animal Explorer', async ({ page, device }) => {
  await toPlayZone(page);
  await page.getByRole('button', { name: 'Play Animal Explorer', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Animal quiz/ })).toBeVisible();
  await check(page, device, 'Animal Explorer');

  await page.getByRole('button', { name: /^Animal quiz/ }).click();
  await page.getByRole('button', { name: '▶ Start', exact: true }).click();
  const choices = page.getByTestId('animal-quiz-choice');
  await expect(choices.first()).toBeVisible();
  await check(page, device, 'animal quiz question', [choices.first(), choices.last()]);
  await choices.first().click();
  if (await page.getByText('🤩 Did you know?', { exact: true }).count() === 0) await choices.nth(1).click();
  await expect(page.getByText('🤩 Did you know?', { exact: true })).toBeVisible();
  // The fact card pushes Next below the fold on shorter phones; scrolling to it is fine here.
  const next = page.getByRole('button', { name: /Next|See my stars/ }).first();
  await next.scrollIntoViewIfNeeded();
  await check(page, device, 'animal quiz fun fact', [next]);

  await page.getByRole('button', { name: '← Explorer' }).click();
  await page.getByRole('button', { name: /^Animal sounds/ }).click();
  await check(page, device, 'animal sounds');
  await page.getByRole('button', { name: /Explorer|Back/ }).first().click();
  await page.getByRole('button', { name: /^My animal album/ }).click();
  await check(page, device, 'animal album');
});
