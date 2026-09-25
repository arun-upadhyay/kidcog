-- Parent account deletion: flag now, erase after 30 days.
--
-- When a parent deletes their account, the API records it here, bans the login
-- in Supabase Auth (so they cannot sign in) and signs out every device. The
-- data is hidden from the app immediately but kept for 30 days, so an
-- accidental deletion can be undone (see `npm run restore-account` in server/).
--
-- After purge_after, the API's cleanup job deletes the auth user. Every table
-- references auth.users with ON DELETE CASCADE, so that one delete also erases
-- this row, the child profiles, sessions, questions, answers and results.
-- Apple's account-deletion rule (5.1.1(v)) and COPPA both expect the data to
-- actually go away, which is why this is not a flag that is kept forever.

create table if not exists public.parent_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  deleted_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  check ((deleted_at is null) = (purge_after is null))
);

create index if not exists parent_accounts_purge_idx
  on public.parent_accounts(purge_after) where deleted_at is not null;

-- Server-only table: RLS on with no policies, so the app's public key can never
-- read or change it. The API uses the service-role key.
alter table public.parent_accounts enable row level security;
