import { test, expect } from '@playwright/test';

test('activity preview leads to parent sign-up and back', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Ready for a little adventure?' })).toBeVisible();
  for (const name of ['Animal Explorer', 'Play Zone', 'Number Snake', 'Big ideas', 'Kind hearts', 'Story time', 'Number magic']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) }).first()).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The real public-grid tile visibly responds, then leads to parent sign-up.
  const numberSnake = page.getByRole('button', { name: /^Number Snake/ });
  await numberSnake.hover();
  await expect.poll(() => numberSnake.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('4px');
  await numberSnake.click();
  await expect(page.getByText('Unlock Number Snake', { exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('button', { name: 'Create parent account' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to activities' }).click();
  await expect(page.getByText('What sounds fun today?', { exact: true })).toBeVisible();
  const parentSignIn = page.getByRole('button', { name: 'Parent sign in', exact: true });
  await expect(parentSignIn).toHaveCount(2);
  await parentSignIn.first().click();
  await expect(page.getByText('Welcome to KidCog', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();
});
