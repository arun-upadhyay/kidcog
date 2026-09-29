import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 45000, fullyParallel: false, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:8091', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'small-phone', use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: 'landscape', use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
    { name: 'laptop', use: { viewport: { width: 1280, height: 720 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
  ],
  webServer: { command: 'npx expo start --web --port 8091 --offline', url: 'http://localhost:8091', timeout: 120000, reuseExistingServer: false,
    env: { CI: '1', EXPO_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-only', EXPO_PUBLIC_API_URL: 'http://localhost:4999', EXPO_PUBLIC_IDLE_LOGOUT_MINUTES: '0' } },
});
