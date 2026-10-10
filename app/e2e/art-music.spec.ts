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


test('art and music supports creating, saving, tracing and playing', async ({ page }) => {
  test.setTimeout(90000);
  await games(page);
  await page.getByRole('button', {name:'Open Art & Music',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Open (Coloring Studio|Paint by Number|Paint by Word|Free Draw|Rainbow Tracing|Piano Playground|Beat Builder|Music & Movement|Connect the Dots)$/})).toHaveCount(9);
  await page.screenshot({path:`/private/tmp/kidcog-art/${test.info().project.name}-hub.png`,fullPage:true});
  const back = () => page.getByRole('button',{name:'← Art & Music',exact:true}).click();
  await page.getByRole('button',{name:'Open Coloring Studio',exact:true}).click();
  await page.getByRole('button',{name:'Red',exact:true}).click();
  await page.getByRole('button',{name:'Paint region 1',exact:true}).click();
  await page.getByRole('button',{name:'Save picture',exact:true}).click();
  await expect(page.getByText('Saved on this device for this child.')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kidcog.art.v1.e2e-child.color.0')!).fills[0])).toBe('#EF665D');
  await page.getByRole('button',{name:'Start over',exact:true}).click();
  await page.getByRole('button',{name:'Yes, clear',exact:true}).click();
  await page.getByRole('button',{name:'Load saved picture',exact:true}).click();
  await expect(page.getByText('Your saved picture is back!')).toBeVisible();
  await back();
  for(const [title,palette,region] of [['Paint by Number','5 Blue','Paint region 1, number 5'],['Paint by Word','go Blue','Paint region 1, word go']]) {
    await page.getByRole('button',{name:`Open ${title}`,exact:true}).click();
    await page.getByRole('button',{name:region,exact:true}).click();
    await expect(page.getByText(/^Find .* on the palette/)).toBeVisible();
    await page.getByRole('button',{name:palette,exact:true}).click();
    await page.getByRole('button',{name:region,exact:true}).click();
    await expect(page.getByText('Lovely color!')).toBeVisible();
    await back();
  }
  for(const title of ['Free Draw','Rainbow Tracing']) {
    await page.getByRole('button',{name:`Open ${title}`,exact:true}).click();
    if(title==='Rainbow Tracing') await page.getByRole('button',{name:'LOOK',exact:true}).click();
    const canvas=page.getByTestId('art-canvas');await canvas.scrollIntoViewIfNeeded();const box=(await canvas.boundingBox())!;
    await page.mouse.move(box.x+box.width*.2,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.7,{steps:8});await page.mouse.up();
    await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Save picture',exact:true}).click();await expect(page.getByText('Saved on this device for this child.')).toBeVisible();
    await page.screenshot({path:`/private/tmp/kidcog-art/${test.info().project.name}-${title.replace(' ','-')}.png`,fullPage:true});
    await back();
  }
  await page.getByRole('button',{name:'Open Piano Playground',exact:true}).click();
  await page.getByRole('button',{name:'Play C',exact:true}).click();await expect(page.getByText('Last note: C')).toBeVisible();
  await page.screenshot({path:`/private/tmp/kidcog-art/${test.info().project.name}-piano.png`,fullPage:true});await back();
  await page.getByRole('button',{name:'Open Beat Builder',exact:true}).click();
  const beat=page.getByRole('checkbox',{name:'Kick beat 2',exact:true});await beat.click();await expect(beat).toBeChecked();
  await page.getByRole('button',{name:'Play music',exact:true}).click();await expect(page.getByRole('button',{name:'Stop music',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Stop music',exact:true}).click();await back();
  await page.getByRole('button',{name:'Open Music & Movement',exact:true}).click();await page.getByRole('button',{name:'Play music',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop music',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Little Shape Parade',exact:true}).click();await expect(page.getByRole('button',{name:'Play music',exact:true})).toBeVisible();await back();
  await page.getByRole('button',{name:'Open Connect the Dots',exact:true}).click();await expect(page.getByRole('button',{name:'Back to the Play Zone',exact:true})).toBeVisible();
});
