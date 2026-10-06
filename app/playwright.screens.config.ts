import { defineConfig } from '@playwright/test';
import { DEVICES, type Device } from './e2e/screens/devices';

/**
 * Screen-size suite: every screen on every phone and tablet in
 * e2e/screens/devices.ts.  npm run test:screens
 *
 * It tests a production web build of the app (the same screens and layout as
 * the iPhone and Android apps), served locally with fake data, so no real
 * server, sign-in or AI is used. Native-only behaviour (keyboard, fonts,
 * Android back button) still needs a check on a real device.
 */
const PORT = 8092;
const env = {
  CI: '1',
  EXPO_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-only',
  EXPO_PUBLIC_API_URL: 'http://localhost:4999',
  EXPO_PUBLIC_IDLE_LOGOUT_MINUTES: '0',
};

export default defineConfig<{ device: Device }>({
  testDir: './e2e/screens',
  timeout: 120_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI_WORKERS ? Number(process.env.CI_WORKERS) : 3,
  retries: process.env.GITHUB_ACTIONS ? 1 : 0,
  reporter: [['list'], ['./e2e/screens/gallery-reporter.ts'], ['html', { open: 'never', outputFolder: 'screens-report/playwright' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure', deviceScaleFactor: 1 },
  projects: DEVICES.map(device => ({
    name: device.name,
    use: {
      device,
      viewport: { width: device.width, height: device.height },
      // Tablets get the mouse-and-touch mix of an iPad; phones get touch only.
      isMobile: !device.tablet,
      hasTouch: true,
    },
  })),
  webServer: {
    // --clear: Metro caches the EXPO_PUBLIC_ values it inlined last time; the test values must win.
    command: `npx expo export -p web --output-dir dist-screens --clear && npx --yes serve -s dist-screens -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env,
  },
});
