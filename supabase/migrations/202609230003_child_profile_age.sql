alter table public.child_profiles
  add column if not exists age integer check (age between 4 and 12);

-- Existing profiles can inherit the age from their most recent assessment.
update public.child_profiles as child
set age = (
  select session.age_snapshot
  from public.assessment_sessions as session
  where session.child_id = child.id and session.age_snapshot is not null
  order by coalesce(session.completed_at, session.started_at) desc
  limit 1
)
where child.age is null
  and exists (
    select 1 from public.assessment_sessions as session
    where session.child_id = child.id and session.age_snapshot is not null
  );
