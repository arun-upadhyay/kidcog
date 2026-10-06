# Screen-size checks

Opens every screen of KidCog on 15 phones and tablets: iPhones from the SE to the
16 Pro Max, three iPads (upright and on their side), and Android phones, a fold
and a tablet. On each screen it checks that:

- nothing scrolls sideways;
- no text or button sits under the status bar / notch / Dynamic Island or the home bar;
- the controls a child needs (Start, Next, Done, the game arrows, Pause…) are fully on screen without scrolling;
- the page throws no errors.

It also notes text that is cut off without a "…" (as warnings), and takes a screenshot of every screen.

```
cd app
npm run test:screens              # all devices, about 5 minutes
npm run test:screens -- --project="iPhone 16"   # one device
npm run test:screens -- -g games                # one part of the app
npm run test:screens:gallery      # open the screenshot gallery (screens-report/index.html)
npx playwright show-report screens-report/playwright   # step-by-step details of any failure
```

It runs on its own on GitHub for every push and pull request that changes `app/`
(`.github/workflows/screens.yml`); the gallery is attached to each run as the
`screens-report` artifact.

How it works: it builds the web version of the app (same screens and layout as the
iPhone and Android apps) with fake data, so no server, sign-in or AI is used, and
pretends each device's status bar and home bar are there.

- Add a device: `devices.ts`.
- Add a screen: a `check(page, device, 'name', [controls that must be on screen])` line in `screens.spec.ts`.

What it can't see: native-only behaviour (the real keyboard, system fonts and
Larger Text, Android's back button, sounds, microphone, Google/Apple sign-in).
Check those on a real device or with Maestro (`app/.maestro`).
