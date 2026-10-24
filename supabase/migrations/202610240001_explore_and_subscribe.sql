-- Explore first, subscribe later.
--
-- One row per parent account: how much the family has used KidCog, when their
-- explore period started, and whether they have KidCog Plus. The server reads
-- it to decide what is unlocked (server/src/entitlement.ts). Only the server's
-- service role can read or write it.
--
-- Counts are per account, not per device, so reinstalling the app or clearing
-- the browser does not restart the explore period.
--
-- Nothing here changes behaviour on its own: limits only apply when the server
-- runs with SUBSCRIPTIONS_ENABLED=1.

create table if not exists public.account_usage (
  parent_id uuid primary key references auth.users(id) on delete cascade,
  -- Set the first time the account is seen while subscriptions are switched on.
  explore_started_at timestamptz,
  activities_completed integer not null default 0,
  play_rounds integer not null default 0,
  active_days integer not null default 0,
  last_active_date date,
  -- Thinking activities started on usage_date (for the free tier's daily allowance).
  usage_date date,
  activities_started_today integer not null default 0,
  -- KidCog Plus. Set by the store webhook (RevenueCat) once payments are connected,
  -- or by hand for a family you want to give it to.
  premium_until timestamptz,
  premium_source text check (premium_source is null or char_length(premium_source) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_usage enable row level security;
revoke all on public.account_usage from anon, authenticated, public;

-- Records one piece of usage atomically and returns the updated row.
--   p_kind: 'seen' (only marks the day), 'activity_started', 'activity_completed', 'play_round'
--   p_today: the calendar day the server counts in (UTC)
--   p_start_explore: start the explore clock if it has not started yet
create or replace function public.record_account_usage(p_parent uuid, p_kind text, p_today date, p_start_explore boolean)
returns public.account_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.account_usage;
begin
  if p_kind not in ('seen', 'activity_started', 'activity_completed', 'play_round') then
    raise exception 'unknown usage kind %', p_kind;
  end if;

  insert into public.account_usage as u (parent_id) values (p_parent)
  on conflict (parent_id) do nothing;

  update public.account_usage as u set
    explore_started_at = case when p_start_explore and u.explore_started_at is null then now() else u.explore_started_at end,
    active_days = u.active_days + case when p_kind <> 'seen' and (u.last_active_date is null or u.last_active_date <> p_today) then 1 else 0 end,
    last_active_date = case when p_kind <> 'seen' then p_today else u.last_active_date end,
    activities_started_today = case
      when u.usage_date is distinct from p_today then (case when p_kind = 'activity_started' then 1 else 0 end)
      else u.activities_started_today + (case when p_kind = 'activity_started' then 1 else 0 end) end,
    usage_date = case when p_kind = 'activity_started' or u.usage_date is distinct from p_today then p_today else u.usage_date end,
    activities_completed = u.activities_completed + (case when p_kind = 'activity_completed' then 1 else 0 end),
    play_rounds = u.play_rounds + (case when p_kind = 'play_round' then 1 else 0 end),
    updated_at = now()
  where u.parent_id = p_parent
  returning * into result;

  return result;
end;
$$;

revoke all on function public.record_account_usage(uuid, text, date, boolean) from public, anon, authenticated;
grant execute on function public.record_account_usage(uuid, text, date, boolean) to service_role;
