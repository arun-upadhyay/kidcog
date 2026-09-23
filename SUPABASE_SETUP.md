# Supabase setup for KidCog

KidCog uses Supabase for parent sign-in and private assessment storage. Children do not have accounts. A child profile stores only the nickname entered by the parent. Audio recordings are transcribed for scoring and are not stored in Supabase.

## 1. Create the project and tables

Create a Supabase project on the free plan. In its SQL Editor, run:

`supabase/migrations/202609230001_parent_accounts_and_assessments.sql`

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

## 4. Enable Google

In Supabase Authentication → Providers, enable Google and add the credentials supplied by Google. In Google Cloud, use Supabase's callback URL:

- `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

In Supabase Authentication → URL Configuration, add the app destinations to the redirect allow list:

- Native development/builds: `kidcog://auth/callback`
- Web development: the exact local or deployed web URL that Expo opens

Replace `com.example.kidcog` in `app/app.json` with your real iOS bundle identifier and Android package before creating production builds.

## 5. Run locally

From `server/`, run `npm run dev`. From `app/`, run `npx expo start`. Sign in, create or choose a nickname, select an age and category, and complete a round.

The `/api/speak` route remains public because native audio players fetch the stream URL directly. It is rate-limited, accepts only question text, and does not expose account data. All profile, session, answer, transcription, question-generation, and grading routes require a valid parent access token.
