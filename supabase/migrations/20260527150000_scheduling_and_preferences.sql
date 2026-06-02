-- Soporte para el planificador de horarios.
--
-- 1) Preferencias de la familia en la inscripción (días y franja horaria).
-- 2) Datos estructurados de horario en cada grupo (días y franja).
-- 3) Huecos horarios disponibles por día de la escuela (slots editables por
--    el admin desde /admin/settings).
-- 4) Persistir las preferencias en el alumno tras convertirlo, para que el
--    planificador pueda re-evaluar a cualquier alumno, no sólo a los nuevos.

-- ── 1. Preferencias en registrations ───────────────────────────────────
alter table public.registrations
  add column if not exists preferred_days text[] not null default '{}',
  add column if not exists preferred_time_blocks text[] not null default '{}',
  add column if not exists scheduling_notes text;

-- ── 2. Horario estructurado en groups ──────────────────────────────────
alter table public.groups
  add column if not exists weekdays text[] not null default '{}',
  add column if not exists start_time time,
  add column if not exists end_time time;

-- ── 3. Huecos horarios de la escuela ───────────────────────────────────
alter table public.school_settings
  add column if not exists schedule_slots jsonb not null default '[]'::jsonb;

comment on column public.school_settings.schedule_slots is
  'Array de huecos editables por el admin: [{weekday, startTime, endTime, label}]. Sirve como referencia visual y para sugerir horarios al planificador.';

-- ── 4. Preferencias persistidas en student ─────────────────────────────
alter table public.students
  add column if not exists preferred_days text[] not null default '{}',
  add column if not exists preferred_time_blocks text[] not null default '{}';

-- Índice ligero para filtrar alumnos pendientes de asignación
create index if not exists students_group_assignment_idx
  on public.students (group_id) where active = true;
