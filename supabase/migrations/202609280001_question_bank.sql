-- Shared question bank.
--
-- Questions are made from only the category and the child's age (never a
-- name or an answer), so one good question can be reused for every child of
-- that age instead of paying the AI to write a new round each time. A round
-- is picked from here in well under a second; the AI only runs in the
-- background to top the bank up.
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  age integer not null check (age between 4 and 12),
  question_type text not null check (question_type in ('open', 'mcq')),
  skill_facet text not null,
  prompt text not null,
  prompt_key text generated always as (lower(regexp_replace(prompt, '\s+', ' ', 'g'))) stored,
  payload jsonb not null,
  served_count integer not null default 0,
  retired boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists question_bank_prompt_unique on public.question_bank (category_key, age, prompt_key);
create index if not exists question_bank_lookup on public.question_bank (category_key, age) where not retired;

-- Server only: holds answer keys and rubrics.
alter table public.question_bank enable row level security;

-- Which bank question a session's copy came from, so a child is not given the
-- same question twice.
alter table public.generated_questions
  add column if not exists bank_question_id uuid references public.question_bank(id) on delete set null;
create index if not exists generated_questions_bank_idx on public.generated_questions (bank_question_id) where bank_question_id is not null;

-- Bank questions for one category and age, least used first, each marked with
-- whether this child has already had it.
create or replace function public.bank_candidates(p_parent uuid, p_child uuid, p_category text, p_age integer, p_limit integer default 300)
returns table (id uuid, question_type text, skill_facet text, prompt text, payload jsonb, served_count integer, seen boolean)
language sql stable security definer set search_path = public as $$
  select b.id, b.question_type, b.skill_facet, b.prompt, b.payload, b.served_count,
         exists (
           select 1 from public.generated_questions g
           join public.assessment_sessions s on s.id = g.session_id
           where g.bank_question_id = b.id and s.child_id = p_child and s.parent_id = p_parent
         ) as seen
  from public.question_bank b
  where b.category_key = p_category and b.age = p_age and not b.retired
  order by b.served_count asc, b.created_at desc
  limit p_limit;
$$;

create or replace function public.bank_mark_served(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.question_bank set served_count = served_count + 1 where id = any(p_ids);
$$;

revoke all on function public.bank_candidates(uuid, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.bank_mark_served(uuid[]) from public, anon, authenticated;
grant execute on function public.bank_candidates(uuid, uuid, text, integer, integer) to service_role;
grant execute on function public.bank_mark_served(uuid[]) to service_role;

-- Read-aloud audio, stored once per question text and voice, so the same
-- question is never paid for twice. Private: the server streams it.
insert into storage.buckets (id, name, public)
values ('tts-cache', 'tts-cache', false)
on conflict (id) do nothing;
