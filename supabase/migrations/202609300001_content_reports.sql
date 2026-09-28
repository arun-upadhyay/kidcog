-- Reports parents send from the app about AI-made content (a question or the
-- written note). Google Play's AI-generated content policy requires a way to
-- report offensive content from inside the app; this is where those land.
--
-- Only the server (service role) reads or writes this table. A reported
-- question is also retired from the shared question bank straight away, so no
-- other child is given it while it is reviewed.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references auth.users(id) on delete set null,
  session_id uuid,
  kind text not null check (kind in ('question', 'note')),
  question_id text,
  bank_question_id uuid,
  content text not null default '',
  reason text not null check (reason in ('inappropriate', 'wrong', 'confusing', 'other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists content_reports_open on public.content_reports (created_at desc) where status = 'open';

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
