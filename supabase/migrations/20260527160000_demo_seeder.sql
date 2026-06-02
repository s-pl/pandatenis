-- Seeder de datos demo
--
-- Cada fila creada por el seeder lleva `seed_tag = 'panda-demo'` para poder
-- borrarla en bloque sin tocar datos reales. Las tablas hija borran en cascada
-- (guardians, payments, attendance_records, etc.) cuando se elimina el
-- alumno/grupo de origen.

alter table public.school_settings
  add column if not exists demo_seed_active boolean not null default false;

alter table public.groups
  add column if not exists seed_tag text;

alter table public.students
  add column if not exists seed_tag text;

alter table public.leads
  add column if not exists seed_tag text;

alter table public.registrations
  add column if not exists seed_tag text;

alter table public.whatsapp_messages
  add column if not exists seed_tag text;

alter table public.whatsapp_conversations
  add column if not exists seed_tag text;

-- Índices ligeros para que el borrado en bloque sea rápido.
create index if not exists groups_seed_tag_idx on public.groups (seed_tag) where seed_tag is not null;
create index if not exists students_seed_tag_idx on public.students (seed_tag) where seed_tag is not null;
create index if not exists leads_seed_tag_idx on public.leads (seed_tag) where seed_tag is not null;
create index if not exists registrations_seed_tag_idx on public.registrations (seed_tag) where seed_tag is not null;
create index if not exists whatsapp_messages_seed_tag_idx on public.whatsapp_messages (seed_tag) where seed_tag is not null;
create index if not exists whatsapp_conversations_seed_tag_idx on public.whatsapp_conversations (seed_tag) where seed_tag is not null;
