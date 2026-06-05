-- SMS automáticos, promociones por SMS e idioma de comunicación del cliente.
--
-- Objetivos:
--   1. Idioma preferido de comunicación por alumno (es | en) — todos los SMS
--      automáticos se envían en ese idioma.
--   2. Confirmación de pago: enlace público al recibo (token no adivinable).
--   3. Promociones: cartel público con botón "Reserva tu plaza" a WhatsApp,
--      difundido por SMS masivo.
--   4. Log de SMS para trazabilidad e idempotencia de los recordatorios.

-- 1) Idioma de comunicación -------------------------------------------------
alter table public.students
  add column if not exists comm_locale text not null default 'es'
    check (comm_locale in ('es', 'en'));

comment on column public.students.comm_locale is
  'Idioma preferido para comunicaciones automáticas (SMS): es | en.';

-- La inscripción pública también captura el idioma; se hereda al convertir.
alter table public.registrations
  add column if not exists comm_locale text not null default 'es'
    check (comm_locale in ('es', 'en'));

comment on column public.registrations.comm_locale is
  'Idioma elegido por la familia en la inscripción para recibir comunicaciones.';

-- 2) Datos de contacto WhatsApp del negocio (para el botón del cartel) -------
alter table public.school_settings
  add column if not exists whatsapp_booking_number text,
  add column if not exists whatsapp_booking_msg_es text,
  add column if not exists whatsapp_booking_msg_en text;

comment on column public.school_settings.whatsapp_booking_number is
  'Número de WhatsApp (formato internacional, solo dígitos) al que llega el botón "Reserva tu plaza".';

-- 3) Token público del recibo ----------------------------------------------
alter table public.receipts
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists receipts_public_token_key
  on public.receipts (public_token);

comment on column public.receipts.public_token is
  'Token no adivinable para el enlace público del recibo enviado por SMS.';

-- 4) Promociones ------------------------------------------------------------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  title_es text not null,
  title_en text not null,
  poster_path text,
  poster_url text,
  whatsapp_msg_es text,
  whatsapp_msg_en text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.promotions is
  'Carteles de promoción (campus, torneos, etc.) difundidos por SMS con enlace público.';

alter table public.promotions enable row level security;

-- Lectura pública del cartel (la página /p/[slug] no requiere sesión).
drop policy if exists "promotions_public_read" on public.promotions;
create policy "promotions_public_read" on public.promotions
  for select using (active = true);

-- Gestión sólo para staff autenticado.
drop policy if exists "promotions_staff_all" on public.promotions;
create policy "promotions_staff_all" on public.promotions
  for all using (public.is_admin()) with check (public.is_admin());

-- 5) Log de SMS -------------------------------------------------------------
create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  locale text not null default 'es' check (locale in ('es', 'en')),
  kind text not null check (kind in ('promo', 'payment_confirm', 'payment_reminder')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_sid text,
  error text,
  student_id uuid references public.students(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  promotion_id uuid references public.promotions(id) on delete set null,
  -- Etiqueta del ciclo de recordatorio (p.ej. '2026-05-20') para no duplicar envíos.
  reminder_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.sms_messages is
  'Registro de SMS enviados (promociones, confirmaciones y recordatorios) para trazabilidad e idempotencia.';

create index if not exists sms_messages_payment_idx on public.sms_messages (payment_id);
create index if not exists sms_messages_kind_idx on public.sms_messages (kind, created_at desc);

-- Evita enviar dos veces el mismo recordatorio (mismo pago, mismo ciclo).
create unique index if not exists sms_messages_reminder_unique
  on public.sms_messages (payment_id, reminder_key)
  where kind = 'payment_reminder' and reminder_key is not null;

alter table public.sms_messages enable row level security;

drop policy if exists "sms_messages_staff_read" on public.sms_messages;
create policy "sms_messages_staff_read" on public.sms_messages
  for select using (public.is_admin());

-- 6) Storage: bucket público para los carteles ------------------------------
insert into storage.buckets (id, name, public)
values ('promotions', 'promotions', true)
on conflict (id) do update set public = true;

drop policy if exists "promotions_bucket_public_read" on storage.objects;
create policy "promotions_bucket_public_read" on storage.objects
  for select using (bucket_id = 'promotions');

drop policy if exists "promotions_bucket_staff_write" on storage.objects;
create policy "promotions_bucket_staff_write" on storage.objects
  for all using (bucket_id = 'promotions' and public.is_admin())
  with check (bucket_id = 'promotions' and public.is_admin());
