-- Mejoras del flujo de SMS:
--   1. Nuevos tipos de SMS (campaña genérica y bienvenida) y estados de entrega
--      (delivered/undelivered) para los callbacks de estado de Twilio.
--   2. SMS de bienvenida configurable (activar/desactivar + textos) al convertir
--      una inscripción en alumno.
--   3. Plantillas SMS reutilizables.

-- 1) Tipos y estados ---------------------------------------------------------
alter table public.sms_messages drop constraint if exists sms_messages_kind_check;
alter table public.sms_messages
  add constraint sms_messages_kind_check
  check (kind in ('promo', 'payment_confirm', 'payment_reminder', 'campaign', 'welcome'));

alter table public.sms_messages drop constraint if exists sms_messages_status_check;
alter table public.sms_messages
  add constraint sms_messages_status_check
  check (status in ('queued', 'sent', 'failed', 'skipped', 'delivered', 'undelivered'));

-- Búsqueda por SID de proveedor para el callback de estado de entrega.
create index if not exists sms_messages_provider_sid_idx
  on public.sms_messages (provider_sid)
  where provider_sid is not null;

-- 2) SMS de bienvenida configurable -----------------------------------------
alter table public.school_settings
  add column if not exists sms_welcome_enabled boolean not null default false,
  add column if not exists sms_welcome_msg_es text,
  add column if not exists sms_welcome_msg_en text;

comment on column public.school_settings.sms_welcome_enabled is
  'Si está activo, se envía un SMS de bienvenida al convertir una inscripción en alumno.';

-- 3) Plantillas SMS reutilizables -------------------------------------------
create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body_es text not null,
  body_en text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sms_templates is
  'Plantillas de SMS reutilizables (texto en ES y EN) para campañas del panel.';

alter table public.sms_templates enable row level security;

drop policy if exists "sms_templates_staff_all" on public.sms_templates;
create policy "sms_templates_staff_all" on public.sms_templates
  for all using (public.is_admin()) with check (public.is_admin());
