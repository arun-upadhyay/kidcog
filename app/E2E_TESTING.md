# UI integration testing

Run from `app`:

```
npm run test:e2e
npm run test:e2e:report
```

Playwright starts a separate Expo web server on port 8091. It uses a fake Supabase session and intercepts API requests with synthetic data. It does not test real login, real scoring, or production services. No production authentication bypass is added to the app.

Projects: desktop 1440×900, phone 390×844 with touch emulation, tablet 768×1024. Tests verify delayed profile loading, retry after 429, navigation into all four games, pause/start, controls inside the viewport (not merely visible somewhere in a scroll view), exact answer/question pairing at submission, and launching another category from results.

Screenshots and traces are saved in test-results; the HTML report links failures. The saved-player homepage has screenshot comparison baselines. Review images before intentionally updating them with `npm run test:e2e -- --update-snapshots`. Dynamic game screenshots are evidence, not pixel baselines: random positions would produce false alarms.

## Android

`.maestro/games.yaml` is a native smoke flow. Requires Maestro, an attached Android device/emulator, and the installed app. Start at the activity picker with a dedicated synthetic test child that has completed three activities (to unlock all games), then run:

```
maestro test .maestro/games.yaml
```

This native flow has not been executed. Maestro and adb were not found on this machine. Do not treat browser phone emulation as native Android verification. Microphone recording, Google login redirects, offline recovery on-device, full tracing accuracy and game completion still require additional native tests.

## Extended viewport and recovery checks

The suite now contains 54 cases (9 scenarios across 6 Chromium viewports). Added small-phone 320×568, landscape 844×390, and laptop 1280×720. Existing homepage screenshot comparisons remain limited to the three reviewed baseline sizes.

Additional scenarios exercise two full cycles through all four games, pause/resume, uncaught browser errors, page horizontal overflow, and recovery from a simulated generation HTTP 503. The retry check verifies the selected trait and exactly two generation requests (one failure, one retry).

The expanded viewport run exposed start-control clipping in Number Snake on small phones and in Number Snake/Bubble Pop in landscape. The responsive layout now reduces decorative content and board height on short screens, keeping the start and gameplay controls available. Viewport assertions remain strict; no screenshot baselines or visibility thresholds were relaxed.

Run repeatedly to investigate intermittent failures:

```
npm run test:e2e -- --repeat-each=3
```

These checks do not establish complete game correctness, accessibility compliance, native touch behavior, live AI response quality, or production load performance.
