-- Centro operativo del panel: tareas derivadas, CRM de contactos, consentimiento y auditoria.

alter type public.lead_status add value if not exists 'interesado';
alter type public.lead_status add value if not exists 'prueba_agendada';
alter type public.lead_status add value if not exists 'perdido';

alter table public.leads
  add column if not exists next_action_at timestamptz,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists lost_reason text,
  add column if not exists whatsapp_consent boolean not null default false,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_source text,
  add column if not exists consent_text text,
  add column if not exists consent_at timestamptz;

create index if not exists leads_status_next_action_idx
  on public.leads (status, next_action_at nulls last);

create index if not exists leads_assigned_to_idx
  on public.leads (assigned_to)
  where assigned_to is not null;

create table if not exists public.admin_task_states (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  dismissed_at timestamptz,
  snoozed_until timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_task_states_snoozed_idx
  on public.admin_task_states (snoozed_until)
  where snoozed_until is not null;

alter table public.admin_task_states enable row level security;

drop policy if exists "admin task states read authenticated" on public.admin_task_states;
drop policy if exists "admin task states admin write" on public.admin_task_states;

create policy "admin task states read authenticated" on public.admin_task_states
  for select to authenticated using (true);

create policy "admin task states admin write" on public.admin_task_states
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists admin_task_states_updated_at on public.admin_task_states;
create trigger admin_task_states_updated_at
  before update on public.admin_task_states
  for each row execute function public.set_updated_at();

create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_log_entity_idx
  on public.admin_activity_log (entity_type, entity_id, created_at desc);

create index if not exists admin_activity_log_created_idx
  on public.admin_activity_log (created_at desc);

alter table public.admin_activity_log enable row level security;

drop policy if exists "admin activity read authenticated" on public.admin_activity_log;
drop policy if exists "admin activity admin write" on public.admin_activity_log;

create policy "admin activity read authenticated" on public.admin_activity_log
  for select to authenticated using (true);

create policy "admin activity admin write" on public.admin_activity_log
  for insert to authenticated with check (public.is_admin());

comment on table public.admin_task_states is
  'Estado manual de tareas derivadas del panel: pospuestas u ocultadas sin tocar el dato de origen.';

comment on table public.admin_activity_log is
  'Auditoria ligera de acciones administrativas relevantes del panel.';
