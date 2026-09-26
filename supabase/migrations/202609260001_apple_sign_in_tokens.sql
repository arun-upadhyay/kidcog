-- Sign in with Apple: keep Apple's refresh token so it can be revoked when the
-- parent deletes their account (Apple asks apps to revoke tokens on deletion:
-- https://developer.apple.com/support/offering-account-deletion-in-your-app/).
--
-- Written only by the API (service-role key). RLS on with no policies, so the
-- app's public key can never read a token. The row disappears with the auth
-- user (ON DELETE CASCADE) when the account is erased.

create table if not exists public.apple_tokens (
  parent_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  client_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.apple_tokens enable row level security;
