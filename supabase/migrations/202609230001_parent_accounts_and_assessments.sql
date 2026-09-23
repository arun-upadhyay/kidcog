create extension if not exists pgcrypto;

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index child_profiles_parent_nickname_unique on public.child_profiles(parent_id, lower(nickname));

create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(), parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(), completed_at timestamptz,
  overall_earned numeric, overall_possible numeric, overall_percent numeric,
  parent_report jsonb, disclaimer text
);

create table public.generated_questions (
  id uuid primary key, session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null, question_type text not null, prompt text not null,
  private_payload jsonb not null, created_at timestamptz not null default now()
);

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  question_id uuid not null references public.generated_questions(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  answer_text text not null, elapsed_seconds numeric, earned numeric not null, possible numeric not null,
  note text not null default '', skipped boolean not null default false, ungraded boolean not null default false,
  created_at timestamptz not null default now(), unique(session_id, question_id)
);

create table public.category_results (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null, label text not null, earned numeric not null, possible numeric not null,
  percent numeric not null, evidence text not null, form_scale jsonb,
  created_at timestamptz not null default now(), unique(session_id, category_key)
);

create index assessment_sessions_parent_child_idx on public.assessment_sessions(parent_id, child_id, started_at desc);
create index generated_questions_session_idx on public.generated_questions(session_id);
create index assessment_answers_session_idx on public.assessment_answers(session_id);
create index category_results_session_idx on public.category_results(session_id);

alter table public.child_profiles enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.generated_questions enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.category_results enable row level security;

create policy "parents manage own child profiles" on public.child_profiles for all using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
create policy "parents read own sessions" on public.assessment_sessions for select using (auth.uid() = parent_id);
create policy "parents read own answers" on public.assessment_answers for select using (auth.uid() = parent_id);
create policy "parents read own category results" on public.category_results for select using (auth.uid() = parent_id);

-- generated_questions intentionally has no client policy: rubrics and answer keys
-- are private. The API uses the service-role key and verifies ownership first.
