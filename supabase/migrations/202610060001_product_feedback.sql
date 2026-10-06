-- Product feedback sent by signed-in parents from the app menu. Only the
-- server service role can read or write these messages. Deleting the parent
-- account also deletes their feedback and any contact permission attached to it.

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('idea', 'problem', 'praise', 'other')),
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(message) between 10 and 2000),
  allow_contact boolean not null default false,
  platform text not null check (char_length(platform) <= 30),
  app_version text not null check (char_length(app_version) <= 30),
  screen text not null check (char_length(screen) <= 50),
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_status_created on public.product_feedback (status, created_at desc);
alter table public.product_feedback enable row level security;
revoke all on public.product_feedback from anon, authenticated;
