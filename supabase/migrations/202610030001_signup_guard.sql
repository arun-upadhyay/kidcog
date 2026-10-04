-- Sign-up guard: stops bots and scripts from creating lots of accounts.
--
-- Supabase calls public.hook_before_user_created just before it creates any new
-- user (email, Google, Apple or Facebook). Returning '{}' lets the sign-up go
-- ahead; returning {"error": ...} stops it and the app shows the message.
--
-- Rules:
--   * Email sign-ups from throwaway (disposable) inbox services are refused.
--   * At most 5 new accounts per IP address per hour, and 20 per day.
--   * At most 300 new accounts per hour in total (a safety brake for a bot wave;
--     raise it if KidCog ever genuinely grows past that).
--
-- After running this migration, switch it on in the Supabase dashboard:
--   Authentication -> Auth Hooks -> Add hook -> "Before User Created"
--   -> Postgres -> schema "public", function "hook_before_user_created".
-- To switch it off again, disable the hook there. No app change is needed.

create table if not exists public.signup_attempts (
  id bigserial primary key,
  ip text,
  email_domain text,
  provider text,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_time on public.signup_attempts (ip, created_at desc);
create index if not exists signup_attempts_time on public.signup_attempts (created_at desc);

-- Only Supabase Auth reads or writes this table; the app and the public cannot.
alter table public.signup_attempts enable row level security;
revoke all on public.signup_attempts from anon, authenticated, public;
drop policy if exists "Supabase Auth manages sign-up attempts" on public.signup_attempts;
create policy "Supabase Auth manages sign-up attempts" on public.signup_attempts
  as permissive for all to supabase_auth_admin using (true) with check (true);

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  user_email text := lower(coalesce(event->'user'->>'email', ''));
  user_domain text := split_part(lower(coalesce(event->'user'->>'email', '')), '@', 2);
  user_provider text := coalesce(event->'user'->'app_metadata'->>'provider', 'email');
  user_ip text := nullif(event->'metadata'->>'ip_address', '');
  per_ip_hour int;
  per_ip_day int;
  all_hour int;
begin
  -- Throwaway inboxes (email sign-ups only; Google/Apple accounts are real).
  if user_provider = 'email' and user_domain = any (array[
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
    'grr.la', 'guerrillamailblock.com', '10minutemail.com', '10minutemail.net', 'tempmail.com',
    'temp-mail.org', 'temp-mail.io', 'tempmail.net', 'tempmailo.com', 'tempail.com', 'throwawaymail.com',
    'yopmail.com', 'yopmail.net', 'yopmail.fr', 'getnada.com', 'nada.email', 'trashmail.com',
    'trashmail.de', 'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'mohmal.com',
    'fakeinbox.com', 'emailondeck.com', 'spamgourmet.com', 'mailcatch.com', 'mytemp.email',
    'tempinbox.com', 'burnermail.io', 'inboxkitten.com', 'mail.tm', 'mail.gw', 'emailfake.com',
    'fakemail.net', 'discard.email', 'spambox.us', 'moakt.com', 'tmail.ws', 'tmpmail.org',
    'tmpmail.net', 'linshiyouxiang.net', 'mailpoof.com', '33mail.com', 'anonaddy.me', 'harakirimail.com',
    'mvrht.net', 'byom.de', 'trbvm.com', 'cuvox.de', 'armyspy.com', 'dayrep.com', 'einrot.com',
    'fleckens.hu', 'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us'
  ]) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'Please use your own email address. Temporary email services can''t be used for a KidCog parent account.'));
  end if;

  -- Keep the log small: two days is all the limits below look at.
  delete from public.signup_attempts where created_at < now() - interval '2 days';

  if user_ip is not null then
    select count(*) filter (where created_at > now() - interval '1 hour'),
           count(*)
      into per_ip_hour, per_ip_day
      from public.signup_attempts
     where ip = user_ip and created_at > now() - interval '1 day';

    if per_ip_hour >= 5 or per_ip_day >= 20 then
      return jsonb_build_object('error', jsonb_build_object(
        'http_code', 400,
        'message', 'Too many new accounts have been created from this network. Please try again later.'));
    end if;
  end if;

  select count(*) into all_hour from public.signup_attempts where created_at > now() - interval '1 hour';
  if all_hour >= 300 then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'Sign-ups are very busy right now. Please try again in a little while.'));
  end if;

  insert into public.signup_attempts (ip, email_domain, provider) values (user_ip, user_domain, user_provider);
  return '{}'::jsonb;
end;
$$;

-- Only Supabase Auth may run the hook or touch its table.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;
grant select, insert, delete on public.signup_attempts to supabase_auth_admin;
grant usage, select on sequence public.signup_attempts_id_seq to supabase_auth_admin;
