create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'profesor');
create type public.tennis_level as enum ('Rojo', 'Naranja', 'Verde', 'Amarillo');
create type public.attendance_status as enum ('asistio', 'no_asistio', 'aviso_ausencia');
create type public.payment_status as enum ('pagado', 'pendiente', 'atrasado');
create type public.payment_method as enum ('efectivo', 'transferencia', 'bizum');
create type public.message_status as enum ('queued', 'sent', 'failed', 'delivered');
create type public.event_type as enum ('campamento', 'torneo', 'clase_especial', 'reunion', 'otro');
create type public.lead_interest as enum ('escuela', 'campus');
create type public.lead_status as enum ('nuevo', 'contactado', 'convertido');
create type public.registration_status as enum ('pendiente', 'confirmada', 'convertida');
create type public.media_type as enum ('foto', 'video');
create type public.timeline_type as enum ('grupo', 'evaluacion', 'medalla', 'foto', 'torneo', 'pago');
create type public.message_category as enum ('recibo', 'promocion', 'evento', 'inscripcion', 'galeria');
create type public.related_message_type as enum ('recibo', 'promocion', 'galeria', 'evento', 'inscripcion');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'profesor',
  phone text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_settings (
  id boolean primary key default true,
  student_goal integer not null default 120,
  absence_alert_threshold integer not null default 75,
  school_name text not null default 'Asociacion Panda Tenis',
  receipt_prefix text not null default 'PT',
  fiscal_name text,
  fiscal_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_settings_single_row check (id)
);

insert into public.school_settings (id, fiscal_name, fiscal_address)
values (true, 'Asociacion Panda Tenis', 'Calle Opalo, Riviera del Sol, Mijas Costa 29649')
on conflict (id) do nothing;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level public.tennis_level not null,
  professor_id uuid references public.profiles(id) on delete set null,
  schedule text not null,
  capacity integer not null check (capacity > 0),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  address text,
  level public.tennis_level not null,
  dominant_hand text not null default 'Derecha',
  group_id uuid references public.groups(id) on delete set null,
  professor_id uuid references public.profiles(id) on delete set null,
  start_date date not null default current_date,
  medical_info text,
  image_consent boolean not null default false,
  coach_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  relationship text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  professor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create table public.progress_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null,
  drive integer not null check (drive between 0 and 100),
  reves integer not null check (reves between 0 and 100),
  saque integer not null check (saque between 0 and 100),
  actitud integer not null check (actitud between 0 and 100),
  asistencia integer not null check (asistencia between 0 and 100),
  coach_comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.student_timeline_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  title text not null,
  detail text,
  type public.timeline_type not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  concept text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  due_date date not null,
  paid_at timestamptz,
  status public.payment_status not null default 'pendiente',
  method public.payment_method,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  receipt_number text not null unique,
  generated_at timestamptz not null default now(),
  pdf_path text,
  whatsapp_message_id uuid,
  created_at timestamptz not null default now()
);

create table public.private_lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  price numeric(10, 2) not null check (price >= 0),
  payment_status public.payment_status not null default 'pendiente',
  professor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null,
  criteria text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.medals (name, color, criteria, sort_order) values
  ('Verde', '#2f9e44', 'Control inicial', 1),
  ('Azul', '#1971c2', 'Direccion y ritmo', 2),
  ('Roja', '#e03131', 'Competicion guiada', 3),
  ('Amarilla', '#f59f00', 'Saque y regularidad', 4),
  ('Naranja', '#f76707', 'Premio final', 5)
on conflict (name) do nothing;

create table public.student_medals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  medal_id uuid not null references public.medals(id) on delete cascade,
  awarded_at date not null default current_date,
  awarded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, medal_id)
);

create table public.term_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null,
  progress_evaluation_id uuid references public.progress_evaluations(id) on delete set null,
  coach_comment text,
  printable_path text,
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  type public.media_type not null,
  storage_path text not null,
  title text not null,
  consent_checked boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.lead_sources (name) values
  ('Cartel en la calle'),
  ('Google'),
  ('Redes sociales'),
  ('Recomendacion'),
  ('Otros')
on conflict (name) do nothing;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  child_age integer check (child_age between 1 and 18),
  interest public.lead_interest not null,
  source_id uuid references public.lead_sources(id) on delete set null,
  observations text,
  status public.lead_status not null default 'nuevo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  type public.lead_interest not null,
  full_name text not null,
  phone text not null,
  child_name text not null,
  child_age integer check (child_age between 1 and 18),
  status public.registration_status not null default 'pendiente',
  lead_id uuid references public.leads(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.message_category not null,
  body text not null,
  meta_template_name text not null unique,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  recipient_phone text not null,
  template_id uuid references public.message_templates(id) on delete set null,
  template_name text not null,
  status public.message_status not null default 'queued',
  related_type public.related_message_type not null,
  related_id uuid,
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz
);

alter table public.receipts
  add constraint receipts_whatsapp_message_id_fkey
  foreign key (whatsapp_message_id) references public.whatsapp_messages(id) on delete set null;

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type public.event_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  description text,
  color text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_valid_range check (ends_at >= starts_at)
);

create table public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  offset_minutes integer not null check (offset_minutes > 0),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index students_group_idx on public.students(group_id);
create index students_professor_idx on public.students(professor_id);
create index guardians_student_idx on public.guardians(student_id);
create index classes_group_date_idx on public.classes(group_id, date);
create index attendance_student_idx on public.attendance_records(student_id);
create index payments_student_status_idx on public.payments(student_id, status);
create index timeline_student_date_idx on public.student_timeline_events(student_id, date desc);
create index media_assets_student_idx on public.media_assets(student_id);
create index whatsapp_messages_status_idx on public.whatsapp_messages(status);
create index calendar_events_starts_at_idx on public.calendar_events(starts_at);
create index event_reminders_scheduled_idx on public.event_reminders(scheduled_for) where sent_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.school_settings
  for each row execute function public.set_updated_at();
create trigger groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger guardians_updated_at before update on public.guardians
  for each row execute function public.set_updated_at();
create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger attendance_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger private_lessons_updated_at before update on public.private_lessons
  for each row execute function public.set_updated_at();
create trigger term_reports_updated_at before update on public.term_reports
  for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger registrations_updated_at before update on public.registrations
  for each row execute function public.set_updated_at();
create trigger templates_updated_at before update on public.message_templates
  for each row execute function public.set_updated_at();
create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'profesor'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.students s
      where s.id = target_student_id
        and s.professor_id = auth.uid()
    )
$$;

create or replace function public.can_access_class(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.classes c
      where c.id = target_class_id
        and c.professor_id = auth.uid()
    )
$$;

create or replace function public.log_student_group_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.group_id is distinct from new.group_id then
    insert into public.student_timeline_events (student_id, title, detail, type)
    values (new.id, 'Cambio de grupo', 'El alumno ha cambiado de grupo.', 'grupo');
  end if;
  return new;
end;
$$;

create trigger students_group_timeline
  after update of group_id on public.students
  for each row execute function public.log_student_group_change();

create or replace function public.log_progress_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_timeline_events (student_id, title, detail, type)
  values (new.student_id, 'Evaluacion realizada', 'Informe ' || new.term || ' registrado.', 'evaluacion');
  return new;
end;
$$;

create trigger progress_timeline
  after insert on public.progress_evaluations
  for each row execute function public.log_progress_evaluation();

create or replace function public.log_student_medal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  medal_name text;
begin
  select name into medal_name from public.medals where id = new.medal_id;
  insert into public.student_timeline_events (student_id, title, detail, type)
  values (new.student_id, 'Medalla obtenida', coalesce(medal_name, 'Medalla') || ' conseguida.', 'medalla');
  return new;
end;
$$;

create trigger student_medal_timeline
  after insert on public.student_medals
  for each row execute function public.log_student_medal();

create or replace function public.log_media_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_timeline_events (student_id, title, detail, type)
  values (new.student_id, 'Archivo añadido', new.title, 'foto');
  return new;
end;
$$;

create trigger media_asset_timeline
  after insert on public.media_assets
  for each row execute function public.log_media_asset();

create or replace function public.create_receipt_for_paid_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text;
  next_number integer;
  receipt_number text;
begin
  if new.status = 'pagado' and old.status is distinct from 'pagado' then
    select receipt_prefix into prefix from public.school_settings where id = true;
    select count(*) + 1 into next_number from public.receipts;
    receipt_number := coalesce(prefix, 'PT') || '-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 4, '0');

    insert into public.receipts (payment_id, receipt_number)
    values (new.id, receipt_number)
    on conflict (payment_id) do nothing;

    insert into public.student_timeline_events (student_id, title, detail, type)
    values (new.student_id, 'Pago marcado como pagado', new.concept || ' - ' || new.amount::text || ' EUR', 'pago');
  end if;
  return new;
end;
$$;

create trigger paid_payment_receipt
  after update of status on public.payments
  for each row execute function public.create_receipt_for_paid_payment();

alter table public.profiles enable row level security;
alter table public.school_settings enable row level security;
alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.classes enable row level security;
alter table public.attendance_records enable row level security;
alter table public.progress_evaluations enable row level security;
alter table public.student_timeline_events enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.private_lessons enable row level security;
alter table public.medals enable row level security;
alter table public.student_medals enable row level security;
alter table public.term_reports enable row level security;
alter table public.media_assets enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.registrations enable row level security;
alter table public.message_templates enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_reminders enable row level security;

create policy "profiles select own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin write" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "settings read authenticated" on public.school_settings
  for select to authenticated using (true);
create policy "settings admin write" on public.school_settings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "groups read authenticated" on public.groups
  for select to authenticated using (true);
create policy "groups admin write" on public.groups
  for all using (public.is_admin()) with check (public.is_admin());
create policy "groups professor update own" on public.groups
  for update using (professor_id = auth.uid()) with check (professor_id = auth.uid());

create policy "students read admin or professor" on public.students
  for select using (public.is_admin() or professor_id = auth.uid());
create policy "students admin insert" on public.students
  for insert with check (public.is_admin());
create policy "students admin update" on public.students
  for update using (public.is_admin()) with check (public.is_admin());
create policy "students professor update own" on public.students
  for update using (professor_id = auth.uid()) with check (professor_id = auth.uid());
create policy "students admin delete" on public.students
  for delete using (public.is_admin());

create policy "guardians access via student" on public.guardians
  for select using (public.can_access_student(student_id));
create policy "guardians admin write" on public.guardians
  for all using (public.is_admin()) with check (public.is_admin());

create policy "classes read admin or professor" on public.classes
  for select using (public.is_admin() or professor_id = auth.uid());
create policy "classes admin write" on public.classes
  for all using (public.is_admin()) with check (public.is_admin());
create policy "classes professor update own" on public.classes
  for update using (professor_id = auth.uid()) with check (professor_id = auth.uid());

create policy "attendance access via class" on public.attendance_records
  for select using (public.can_access_class(class_id));
create policy "attendance admin write" on public.attendance_records
  for all using (public.is_admin()) with check (public.is_admin());
create policy "attendance professor upsert own class" on public.attendance_records
  for insert with check (public.can_access_class(class_id));
create policy "attendance professor update own class" on public.attendance_records
  for update using (public.can_access_class(class_id)) with check (public.can_access_class(class_id));

create policy "student scoped read progress" on public.progress_evaluations
  for select using (public.can_access_student(student_id));
create policy "student scoped write progress" on public.progress_evaluations
  for insert with check (public.can_access_student(student_id));

create policy "student scoped read timeline" on public.student_timeline_events
  for select using (public.can_access_student(student_id));
create policy "admin write timeline" on public.student_timeline_events
  for all using (public.is_admin()) with check (public.is_admin());

create policy "student scoped read payments" on public.payments
  for select using (public.can_access_student(student_id));
create policy "admin write payments" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "receipts read via payment student" on public.receipts
  for select using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id and public.can_access_student(p.student_id)
    )
  );
create policy "admin write receipts" on public.receipts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "student scoped private lessons read" on public.private_lessons
  for select using (public.can_access_student(student_id) or professor_id = auth.uid());
create policy "admin write private lessons" on public.private_lessons
  for all using (public.is_admin()) with check (public.is_admin());
create policy "professor update own private lessons" on public.private_lessons
  for update using (professor_id = auth.uid()) with check (professor_id = auth.uid());

create policy "medals read authenticated" on public.medals
  for select to authenticated using (true);
create policy "medals admin write" on public.medals
  for all using (public.is_admin()) with check (public.is_admin());

create policy "student medals read scoped" on public.student_medals
  for select using (public.can_access_student(student_id));
create policy "student medals write scoped" on public.student_medals
  for insert with check (public.can_access_student(student_id));
create policy "student medals admin delete" on public.student_medals
  for delete using (public.is_admin());

create policy "term reports read scoped" on public.term_reports
  for select using (public.can_access_student(student_id));
create policy "term reports write scoped" on public.term_reports
  for insert with check (public.can_access_student(student_id));
create policy "term reports update scoped" on public.term_reports
  for update using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

create policy "media read scoped" on public.media_assets
  for select using (public.can_access_student(student_id));
create policy "media write scoped" on public.media_assets
  for insert with check (public.can_access_student(student_id));
create policy "media admin delete" on public.media_assets
  for delete using (public.is_admin());

create policy "lead sources read" on public.lead_sources
  for select to authenticated using (true);
create policy "lead sources admin write" on public.lead_sources
  for all using (public.is_admin()) with check (public.is_admin());

create policy "leads admin full access" on public.leads
  for all using (public.is_admin()) with check (public.is_admin());
create policy "leads professor read" on public.leads
  for select to authenticated using (true);

create policy "registrations admin full access" on public.registrations
  for all using (public.is_admin()) with check (public.is_admin());
create policy "registrations read authenticated" on public.registrations
  for select to authenticated using (true);

create policy "templates read authenticated" on public.message_templates
  for select to authenticated using (true);
create policy "templates admin write" on public.message_templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "messages read authenticated" on public.whatsapp_messages
  for select to authenticated using (true);
create policy "messages admin write" on public.whatsapp_messages
  for all using (public.is_admin()) with check (public.is_admin());

create policy "calendar read authenticated" on public.calendar_events
  for select to authenticated using (true);
create policy "calendar admin write" on public.calendar_events
  for all using (public.is_admin()) with check (public.is_admin());

create policy "reminders read authenticated" on public.event_reminders
  for select to authenticated using (true);
create policy "reminders admin write" on public.event_reminders
  for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-media',
  'student-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "student media authenticated read" on storage.objects
  for select to authenticated
  using (bucket_id = 'student-media');

create policy "student media authenticated insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'student-media');

create policy "student media admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'student-media' and public.is_admin());
