import { test, expect } from '@playwright/test';

test('activity preview leads to parent sign-in and back', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Ready for a little adventure?' })).toBeVisible();
  for (const name of ['Thinking quests', 'Story sparks', 'Word adventures', 'Play Zone']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('button', { name: /^Thinking quests/ }).click();
  await expect(page.getByText('Unlock Thinking quests', { exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to activities' }).click();
  await expect(page.getByText('What sounds fun today?', { exact: true })).toBeVisible();
  const parentSignIn = page.getByRole('button', { name: 'Parent sign in', exact: true });
  await expect(parentSignIn).toHaveCount(2);
  await parentSignIn.first().click();
  await expect(page.getByText('Welcome to KidCog', { exact: true })).toBeVisible();
});
