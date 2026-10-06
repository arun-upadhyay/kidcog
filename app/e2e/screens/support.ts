import { test as base, expect, type Locator, type Page } from '@playwright/test';
import categories from './categories.json';
import type { Device } from './devices';

/**
 * Shared set-up and checks for the screen-size suite.
 *
 * Every screen visited with `check()` is screenshotted for the gallery and
 * tested for the problems that show up when a layout doesn't fit a device:
 *   1. the page scrolls sideways;
 *   2. text or buttons sit under the status bar / notch or the home bar;
 *   3. a control the child needs (Start, Next, Done, the arrows…) is off screen;
 *   4. text is cut off without a "…" (warnings only, listed in the report);
 *   5. the page threw an error.
 */
export const test = base.extend<{ device: Device; errors: string[] }>({
  device: [{ name: 'default', width: 390, height: 844, insets: { top: 0, bottom: 0 }, platform: 'ios' }, { option: true }],
  errors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await use(errors);
    expect(errors, 'the page threw errors').toEqual([]);
  }, { auto: true }],
  page: async ({ page, device }, use) => {
    // Same "random" choices on every run (quiz questions, game boards, stickers),
    // so a screen that fails, fails every time, and screenshots are comparable.
    await page.addInitScript(() => {
      let seed = 20261006;
      Math.random = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
    await simulateSafeArea(page, device);
    await use(page);
  },
});
export { expect };

/**
 * The app reads the safe area with react-native-safe-area-context, which on the
 * web measures CSS env(safe-area-inset-*). Desktop Chrome has no notch, so we
 * answer that measurement with the device's real insets instead.
 */
async function simulateSafeArea(page: Page, device: Device) {
  await page.addInitScript(insets => {
    const original = window.getComputedStyle;
    window.getComputedStyle = function (this: Window, el: Element, ...rest: [string?]) {
      const style = original.call(this, el, ...rest);
      if (el instanceof HTMLElement && /safe-area-inset/.test(el.getAttribute('style') ?? '')) {
        return new Proxy(style, {
          get(target, key) {
            if (key === 'paddingTop') return `${insets.top}px`;
            if (key === 'paddingBottom') return `${insets.bottom}px`;
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      }
      return style;
    } as typeof window.getComputedStyle;
  }, device.insets);
}

// ---------------------------------------------------------------------------
// Test data (no real server, no real sign-in)
// ---------------------------------------------------------------------------

export const CHILD = { id: 'screens-child', nickname: 'Mia', age: 5, avatar: 'fox', createdAt: '2026-01-01' };

export async function signedIn(page: Page, opts: { children?: unknown[]; progress?: object } = {}) {
  await page.addInitScript(progress => {
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify({ access_token: 'test-only', refresh_token: 'test-only', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'test-parent', email: 'tester@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, last_sign_in_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() } }));
    localStorage.setItem('kidcog.aboutSeen.v1', '1');
    localStorage.setItem('kidcog.progress.v1.screens-child', JSON.stringify(progress));
  }, opts.progress ?? {
    stars: 27, stickers: ['bear', 'owl', 'panda', 'lion', 'butterfly'], levels: {},
    visited: { abstract_concepts: { plays: 3, stars: 6 } }, pictures: { heart: [], cat: [] }, owl: { hat: 'party', neck: 'bow' },
  });
  await page.route('**/auth/v1/**', route => route.fulfill({ json: { id: 'test-parent', app_metadata: {}, user_metadata: {} } }));
  await mockApi(page, opts.children ?? [CHILD]);
}

export async function signedOut(page: Page) {
  await mockApi(page, []);
}

async function mockApi(page: Page, children: unknown[]) {
  await page.route('**/health', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/children') return route.fulfill({ json: method === 'POST' ? CHILD : children });
    if (path === '/api/categories') return route.fulfill({ json: categories });
    if (path === '/api/test') {
      const input = route.request().postDataJSON();
      return route.fulfill({ json: { sessionId: 'screens-session', traits: categories, questionCount: 2, followUpQuestions: {}, remainingUnseen: -1, poolExhausted: false,
        profile: { key: 'early', ageBand: [4, 7], uiScale: 1, showScoreToChild: false, showTimer: false, celebrateEachAnswer: true, openAnswerMode: 'text' },
        questions: [
          { id: 'q1', trait: input.trait, type: 'mcq', prompt: 'What comes next?  🍎 🍌 🍎 🍌 🍎 …', options: [{ key: 'a', text: '🍇 Grapes' }, { key: 'b', text: '🍌 Banana' }, { key: 'c', text: '🍎 Apple' }], format: 'number_series', figure: null, visual: null, spoken: null, followUp: null, speechText: 'What comes next?', timeLimitSeconds: null },
          { id: 'q2', trait: input.trait, type: 'mcq', prompt: 'Which one does not belong?', options: [{ key: 'a', text: '🐶 Dog' }, { key: 'b', text: '🐱 Cat' }, { key: 'c', text: '🚗 Car' }, { key: 'd', text: '🐰 Bunny' }], format: 'classification', figure: null, visual: null, spoken: null, followUp: null, speechText: 'Which one does not belong?', timeLimitSeconds: null },
        ] } });
    }
    if (path === '/api/submit') return route.fulfill({ json: report(route.request().postDataJSON()?.trait ?? 'abstract_concepts') });
    if (path.endsWith('/parent-report')) return route.fulfill({ json: { parentReport: PARENT_REPORT, parentReportError: null } });
    if (path.endsWith('/sessions')) return route.fulfill({ json: [] });
    if (path === '/api/prefetch') return route.fulfill({ status: 202, json: { ready: true } });
    return route.fulfill({ status: 404, json: { error: `Not mocked in the screen-size suite: ${path}` } });
  });
}

const PARENT_REPORT = {
  opening: 'Mia had a lovely, confident round and clearly enjoyed finding the patterns.',
  strengths: ['She spotted the apple–banana pattern straight away.', 'She explained her choice in her own words.'],
  stuckPoints: [], thinkingNotes: 'Mia looks for what things have in common before choosing.',
  practiceIdeas: ['Make a pattern with spoons and forks at dinner.', 'Play “odd one out” with toys.'], closing: 'Keep the games short and playful.',
};

function report(trait: string) {
  return {
    version: 2, generatedAt: new Date().toISOString(), overall: { earned: 6, possible: 6, percent: 100 },
    traits: (categories as { key: string }[]).map(c => c.key === trait
      ? { ...c, questionCount: 2, earned: 6, possible: 6, percent: 100, band: 'Strong', formScale: { value: 5, label: 'Seen clearly' }, evidence: 'Two questions, both solved.' }
      : { ...c, questionCount: 0, earned: 0, possible: 0, percent: 0, band: 'Not seen', formScale: null, evidence: '' }),
    strongest: trait, growthArea: null,
    responses: [
      { questionId: 'q1', trait, type: 'mcq', prompt: 'What comes next?', answer: 'b', earned: 3, possible: 3, elapsedSeconds: 6, note: 'Spotted the pattern.', correct: true, band: 3 },
      { questionId: 'q2', trait, type: 'mcq', prompt: 'Which one does not belong?', answer: 'c', earned: 3, possible: 3, elapsedSeconds: 9, note: 'Picked the car.', correct: true, band: 3 },
    ],
    seenQuestionIds: ['q1', 'q2'], graderFailed: null, disclaimer: 'A practice activity, not a diagnostic test.',
    parentReport: PARENT_REPORT, parentReportPending: false,
  };
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

type Problems = { overflowX: number; underSystemBars: string[]; clipped: string[] };

/**
 * Screenshot the screen for the gallery, then check it. `mustSee` are controls
 * that have to be fully on screen without scrolling (a game's arrows, Done…).
 */
export async function check(page: Page, device: Device, name: string, mustSee: Locator[] = []) {
  await page.waitForTimeout(350); // let entrance animations settle
  const info = test.info();
  await info.attach(`screen:${name}`, { body: await page.screenshot(), contentType: 'image/png' });

  const problems: Problems = await page.evaluate(({ top, bottom }) => {
    const out = { overflowX: document.documentElement.scrollWidth - window.innerWidth, underSystemBars: [] as string[], clipped: [] as string[] };
    const opacity = (el: Element | null) => {
      let o = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) o *= Number(getComputedStyle(e).opacity || 1);
      return o;
    };
    const label = (el: Element) => (el.getAttribute('aria-label') || (el as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    // What a finger would hit in the status-bar strip and the home-bar strip.
    const strips: [number, number][] = ([[2, Math.max(0, top - 2)], [window.innerHeight - bottom + 2, window.innerHeight - 2]] as [number, number][]).filter(([a, b]) => b > a);
    const seen = new Set<string>();
    for (const [y1, y2] of strips) {
      for (let y = y1; y <= y2; y += Math.max(4, (y2 - y1) / 3)) {
        for (let x = 4; x < window.innerWidth; x += 12) {
          let el = document.elementFromPoint(x, y);
          // Climb to something meaningful: a button, or an element with its own text.
          while (el && el !== document.body && !(el.getAttribute('role') === 'button' || Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent!.trim()))) el = el.parentElement;
          if (!el || el === document.body || opacity(el) < 0.5) continue;
          const text = label(el);
          if (text && !seen.has(text)) { seen.add(text); out.underSystemBars.push(text); }
        }
      }
    }
    // Text cut off without an ellipsis.
    for (const el of Array.from(document.querySelectorAll('div'))) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const s = getComputedStyle(el);
      if (s.overflow === 'visible' || s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') continue;
      if (el.scrollWidth > el.clientWidth + 2 && opacity(el) >= 0.5) out.clipped.push(label(el));
    }
    return out;
  }, device.insets);

  if (problems.clipped.length) info.annotations.push({ type: 'warning', description: `${name}: text cut off: ${problems.clipped.slice(0, 5).join(' | ')}` });
  expect.soft(problems.overflowX, `${name}: the page scrolls sideways by ${problems.overflowX}px`).toBeLessThanOrEqual(0);
  expect.soft(problems.underSystemBars, `${name}: under the status bar or home bar`).toEqual([]);
  for (const control of mustSee) await onScreen(page, device, control, name);
}

/** The control is visible and fully inside the usable screen, without scrolling. */
export async function onScreen(page: Page, device: Device, control: Locator, screen: string) {
  await expect(control, `${screen}: control missing`).toBeVisible();
  const box = (await control.boundingBox())!;
  const view = page.viewportSize()!;
  const what = `${screen}: "${(await control.getAttribute('aria-label')) ?? (await control.innerText()).slice(0, 30)}"`;
  expect.soft(box.x, `${what} is cut off on the left`).toBeGreaterThanOrEqual(0);
  expect.soft(box.x + box.width, `${what} is cut off on the right`).toBeLessThanOrEqual(view.width + 0.5);
  expect.soft(box.y, `${what} is under the status bar`).toBeGreaterThanOrEqual(device.insets.top - 0.5);
  expect.soft(box.y + box.height, `${what} is below the screen or under the home bar`).toBeLessThanOrEqual(view.height - device.insets.bottom + 0.5);
}
