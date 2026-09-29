# Android internal testing — 2026-09-29

## Preparation

- Expo login confirmed; no remote build started.
- `play-internal` build profile extends production and creates an Android App Bundle.
- Matching submission profile targets the Google Play internal track as a draft.
- Preview APK profile remains available for direct device installation.

## Checks performed

- App and server TypeScript: passed.
- Current server category, game and question-bank tests: 14 passed.
- App speech tests: 2 passed, 5 failed.
- Older server CJS regression tests: 4 passed, 8 failed. Several reference the removed generateRound export; speech mocks lack supabaseReady; report expectations also differ.
- No Android device testing performed and no AAB uploaded to Google Play.

## Next steps

1. Obtain explicit approval to upload source/configuration to Expo EAS Build.
2. From app: npx eas-cli@latest build --platform android --profile play-internal
3. Inspect the completed build, signing and resolved production environment.
4. Resolve failing regression tests without hiding genuine regressions.
5. Test installation, login/Google callback, saved children, all four games, touch/buttons, microphone denial and recording, scoring/history, offline/retry and account deletion using a dedicated test account.
6. Upload the verified build with the play-internal submit profile; configure testers and inspect the draft in Play Console before rollout.

Use synthetic child nicknames for testing. No tester invitations have been sent.
