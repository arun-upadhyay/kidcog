-- A picture the child picks for their player tile (for example 'fox').
-- Stored as a short key; the app maps keys to pictures. Null means "not
-- picked yet" and the app shows a default.
alter table public.child_profiles
  add column if not exists avatar text
  check (avatar is null or avatar ~ '^[a-z]{2,16}$');
