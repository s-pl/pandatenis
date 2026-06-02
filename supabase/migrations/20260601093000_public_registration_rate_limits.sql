-- Durable, first-party rate limiting for public registration endpoints.
-- No external service is used; public actions call the function through the
-- Supabase service role after hashing the request key.

create table if not exists public.registration_rate_limits (
  scope text not null,
  key_hash text not null,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);

create index if not exists registration_rate_limits_reset_idx
  on public.registration_rate_limits (reset_at);

alter table public.registration_rate_limits enable row level security;

create or replace function public.check_registration_rate_limit(
  p_scope text,
  p_key_hash text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_window interval := make_interval(secs => greatest(1, p_window_seconds));
begin
  delete from public.registration_rate_limits
  where reset_at < now() - interval '1 day';

  insert into public.registration_rate_limits (scope, key_hash, count, reset_at, updated_at)
  values (p_scope, p_key_hash, 1, now() + v_window, now())
  on conflict (scope, key_hash) do update
    set count = case
          when public.registration_rate_limits.reset_at <= now() then 1
          else public.registration_rate_limits.count + 1
        end,
        reset_at = case
          when public.registration_rate_limits.reset_at <= now() then now() + v_window
          else public.registration_rate_limits.reset_at
        end,
        updated_at = now()
  returning count <= greatest(1, p_max) into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.check_registration_rate_limit(text, text, integer, integer) from public;
revoke all on function public.check_registration_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.check_registration_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.check_registration_rate_limit(text, text, integer, integer) to service_role;
