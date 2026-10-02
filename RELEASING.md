# Releasing KidCog to the App Store and Google Play

Every command below runs from the `app/` folder:

```
cd ~/Documents/kidcog/app
```

Each build command typechecks the app first and stops if there is an error, so a broken build never gets uploaded. Builds run on Expo's servers (EAS); you can close the terminal once the upload finishes and follow progress at https://expo.dev/accounts/arun.upadhyay/projects/kidcog/builds

## Quick reference

| Command | What it does |
| --- | --- |
| `npm run eas:login` | Log in to Expo (once per computer) |
| `npm run env:check` | Show the Supabase/API settings each build will get |
| `npm run builds` | List the last 5 builds and their status |
| `npm run release:ios` | Build for iPhone and send it to TestFlight automatically |
| `npm run build:ios` | Build for iPhone only (no upload) |
| `npm run submit:ios` | Send the newest iPhone build to TestFlight |
| `npm run test:android` | Build an `.apk` to install straight onto an Android phone |
| `npm run build:android` | Build the `.aab` for Google Play (no upload) |
| `npm run submit:android` | Send the newest Android build to Play's Internal testing track |
| `npm run release:android` | Build for Google Play and upload automatically |

## Before every release

1. Commit and push your changes (`git status` should be clean). The build uses the files on your Mac, so uncommitted work is included too, but committing first means you always know what went out.
2. Run `npm run env:check`. Both `production` and `preview` must list `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. If they are missing, the app opens but says "Supabase is not configured". Fix them at https://expo.dev/accounts/arun.upadhyay/projects/kidcog/environment-variables (use the publishable/anon key only, never the secret or service_role key).
3. While the build starts, check the line near the top of the output: it must say the variables were loaded from the `production` (or `preview`) environment.

Build numbers go up automatically. When you release a new version to the public stores (not just a new test build), raise `"version"` in `app/app.json` first, e.g. `0.1.0` → `0.2.0`.

## iPhone (App Store)

1. `npm run release:ios` — builds (about 5–15 min) and uploads to App Store Connect.
   It may ask you to log in to your Apple account; answer yes and use arun.upadhyay1107@gmail.com.
2. Upload: follow it under **Submissions** on expo.dev. On the free Expo plan it can wait in a queue ("waiting for an available submitter") for up to an hour. If it is stuck longer, cancel it there and run `npm run submit:ios`.
3. Apple processes the build for 10–30 min and emails you.
4. Test it: open the **TestFlight** app on your iPhone, tap KidCog, tap **Update**, and check the build number.
5. Publish: in https://appstoreconnect.apple.com → Apps → KidCog, open the version, choose the new build under **Build**, then **Add for Review → Submit to App Review**. Review usually takes 1–3 days.

## Android (Google Play)

**Test on your own phone first (no Play Store needed):**

1. `npm run test:android` — builds an `.apk` (about 10 min).
2. Scan the QR code it shows, or open the build link on the phone, and tap **Install** (allow "install unknown apps" for Chrome when asked).

**Upload to Google Play:**

1. `npm run build:android` — builds the `.aab`.
2. The very first upload must be done by hand: download the `.aab` from the build page on expo.dev, then in https://play.google.com/console → KidCog → **Testing → Internal testing → Create new release**, upload it, save and roll out.
3. After that first upload you can let EAS upload for you with `npm run release:android` (or `npm run submit:android` for a build that already exists). This needs a one-time setup: in Play Console go to **Setup → API access**, create a Google service account with release permissions, download its JSON key, then run `npx eas-cli@latest credentials --platform android` and add it under "Google Service Account". Keep that JSON key out of git.
4. Testers install from the Internal testing **join link**. When you are happy, promote the release to **Production** in Play Console and send it for review.

## If something goes wrong

- **"Supabase is not configured" in the app** — the build was made without the environment variables. Fix them (see "Before every release") and build again; changing them never updates a build that already exists.
- **First round is slow** — the Render server was asleep (free plan). Upgrade Render to Starter before store review.
- **Apple build shows "Missing Compliance"** — choose "None of the algorithms mentioned above". It should not appear because `app.json` already answers it.
- **Anything else** — open the build or submission on expo.dev; the logs say which step failed.
