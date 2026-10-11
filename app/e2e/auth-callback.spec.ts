import { test, expect } from '@playwright/test';

const blocked = 'This account is blocked from signing in. If you requested account deletion, contact the KidCog team to restore it before permanent deletion.';
for (const separator of ['?', '#']) {
  test(`blocked OAuth account shows the reason from a ${separator} callback`, async ({page}) => {
    await page.goto(`/auth/callback${separator}error=access_denied&error_code=user_banned&error_description=User+is+banned`);
    await expect(page.getByText(blocked, {exact:true})).toBeVisible();
    await expect(page.getByRole('button', {name:'Sign in with email',exact:true})).toBeVisible();
    await expect(page.getByRole('heading', {name:'Ready for a little adventure?'})).toHaveCount(0);
  });
}

test('PKCE exchange errors reach the login screen', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('sb-e2e-auth-token-code-verifier',JSON.stringify('test-verifier')));
  await page.route('**/auth/v1/token**',route=>route.fulfill({status:403,json:{code:'user_banned',msg:'User is banned'}}));
  await page.goto('/auth/callback?code=test-only-code');
  await expect(page.getByText(blocked,{exact:true})).toBeVisible();
});

test('unknown callback errors show a safe retry message',async({page})=>{
  await page.goto('/auth/callback#error=server_error&error_code=unexpected_failure&error_description=private-provider-detail');
  await expect(page.getByText('We could not complete sign-in. Please try again. (unexpected_failure)',{exact:true})).toBeVisible();
  await expect(page.getByText('private-provider-detail',{exact:true})).toHaveCount(0);
});
