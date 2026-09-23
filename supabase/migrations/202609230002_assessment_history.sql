alter table public.assessment_sessions
  add column if not exists age_snapshot integer check (age_snapshot between 4 and 12),
  add column if not exists report_snapshot jsonb;

create index if not exists assessment_sessions_completed_history_idx
  on public.assessment_sessions(parent_id, child_id, completed_at desc)
  where status = 'completed';
