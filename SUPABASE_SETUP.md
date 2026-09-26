# Supabase setup for KidCog

KidCog uses Supabase for parent sign-in and private assessment storage. Children do not have accounts. A child profile stores only the nickname entered by the parent. Audio recordings are transcribed for scoring and are not stored in Supabase.

## 1. Create the project and tables

Create a Supabase project on the free plan. In its SQL Editor, run:

`supabase/migrations/202609230001_parent_accounts_and_assessments.sql`

Then run the history migration:

`supabase/migrations/202609230002_assessment_history.sql`

Then run the saved-age migration:

`supabase/migrations/202609230003_child_profile_age.sql`

Then run the account-deletion migration:

`supabase/migrations/202609250001_parent_account_deletion.sql`

Then run the Sign in with Apple migration:

`supabase/migrations/202609260001_apple_sign_in_tokens.sql`

Without it the app still works, but "Delete account" fails with "Account deletion is not set up on the server yet" and the server prints a warning.

The migration enables row-level security. The generated-questions table has no client access policy because it contains answer keys and rubrics.

## 2. Configure the server

Copy `server/.env.example` to `server/.env`, then fill in:

- `SUPABASE_URL`: Project Settings → API → Project URL
- `SUPABASE_ANON_KEY`: the publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret
- `OPENAI_API_KEY`: used for question generation, transcription, scoring, and AI voice

Never put the service-role key in the Expo app or commit it to source control.

## 3. Configure the app

Copy `app/.env.example` to `app/.env`, then set the same project URL and the publishable/anon key. For a physical phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN address rather than `localhost`.

## 4. Enable email sign-in

In Supabase Authentication → Providers → Email:

- Enable the Email provider.
- Keep **Confirm email** turned on so new parent accounts must verify their address.

In Authentication → URL Configuration, make sure the same web and native callback destinations listed below are allowed. Supabase sends the verification message; production apps should configure a custom SMTP provider and branded email template before launch.

## 5. Enable Google

In Supabase Authentication → Providers, enable Google and add the credentials supplied by Google. In Google Cloud, use Supabase's callback URL:

- `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

In Supabase Authentication → URL Configuration, add the app destinations to the redirect allow list:

- Native development/builds: `kidcog://auth/callback`
- Web development: the exact local or deployed web URL that Expo opens

Replace `com.example.kidcog` in `app/app.json` with your real iOS bundle identifier and Android package before creating production builds.

## 6. Run locally

From `server/`, run `npm run dev`. From `app/`, run `npx expo start`. Sign in, create or choose a nickname, select an age and category, and complete a round.

The `/api/speak` route remains public because native audio players fetch the stream URL directly. It is rate-limited, accepts only question text, and does not expose account data. All profile, session, answer, transcription, question-generation, and grading routes require a valid parent access token.

## 7. Parent account deletion

Parents can delete their account from the ☰ menu (they type DELETE to confirm). The server then:

1. marks the account deleted in `parent_accounts` and hides all its data from the app,
2. blocks sign-in (password and Google) in Supabase Auth and signs out every device,
3. permanently erases the account after 30 days. The API checks every six hours and deletes the auth user; every table cascades from it, so child profiles, sessions, questions, answers and results go too.

To undo a deletion within the 30 days (for example, a parent writes in and says it was a mistake), run this from `server/` and then restart the API:

```
npm run restore-account -- parent@example.com
```

The 30-day erase only runs while the API server is running. On Render's paid plan the server stays up; on a plan that sleeps, erasure is delayed until the server next starts.

## 8. Sign in with Apple

Apple requires it on iPhone because the app offers Google sign-in (App Review guideline 4.8). On iPhone the app shows Apple's own button and sign-in sheet. On Android and web it is hidden until you finish step 4.

1. **Bundle ID.** Replace `com.example.kidcog` in `app/app.json` with your own (for example `com.yourname.kidcog`). It cannot be changed after the app is published.
2. **Apple Developer → Certificates, IDs & Profiles → Identifiers:** open the App ID for that bundle ID and tick **Sign in with Apple**. (`app.json` already has `"usesAppleSignIn": true`, so EAS builds include the capability.)
3. **Supabase → Authentication → Sign In / Providers → Apple:** enable it and put your bundle ID in **Client IDs**. That is all the iPhone (native) sign-in needs.
4. **Optional, for Android and web:** create a **Services ID** in Apple Developer with the return URL `https://<your-project>.supabase.co/auth/v1/callback`, add it to the Supabase Apple provider with a secret key, then set `EXPO_PUBLIC_APPLE_SIGNIN_WEB=1` in `app/.env` and restart with `./dev.sh --clear`. Apple makes you generate a new secret key every 6 months for this web flow.
5. **Token revocation on account deletion.** Apple asks apps to revoke Sign in with Apple when a parent deletes their account. In Apple Developer → **Keys**, create a key with Sign in with Apple enabled and download the `.p8` file (you can only download it once). Then set these in `server/.env` (and in your host's environment settings when you deploy):

```
APPLE_TEAM_ID=ABCDE12345
APPLE_KEY_ID=XYZ9876543
APPLE_CLIENT_ID=com.yourname.kidcog
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
```

Without these, Apple sign-in still works; the server just prints a warning and cannot revoke the Apple link when an account is deleted.

Sign in with Apple only works in a real iPhone build (EAS build or TestFlight), not in Expo Go.
