-- Convocatorias de campus/intensivos administrables desde /admin/campus.
-- La web pública (/campamentos) lee de esta tabla en lugar del array
-- hardcoded en src/lib/web/courses.ts.

create table if not exists public.campus_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind text not null default 'campus' check (kind in ('campus', 'escuela')),
  dates_label text not null default '',
  intro text not null default '',
  image_path text,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  seed_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campus_courses_public_sort_idx
  on public.campus_courses (is_public, sort_order)
  where is_public = true;

create trigger campus_courses_updated_at
  before update on public.campus_courses
  for each row execute function public.set_updated_at();

alter table public.campus_courses enable row level security;

drop policy if exists "campus_courses public read" on public.campus_courses;
drop policy if exists "campus_courses admin write" on public.campus_courses;

-- Lectura pública (web): solo filas publicadas.
create policy "campus_courses public read" on public.campus_courses
  for select to anon, authenticated
  using (is_public = true);

-- Lectura/escritura completa para admin.
create policy "campus_courses admin write" on public.campus_courses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Semilla mínima para no dejar /campamentos vacío en producción.
insert into public.campus_courses (slug, title, kind, dates_label, intro, sort_order)
values
  ('campus-verano-2026', 'Campus de Verano 2026', 'campus', 'Julio - Agosto 2026',
   'Gracias por inscribirte al **Campus de Verano 2026**. Con este formulario tendremos toda la información para empezar a trabajar juntos.',
   10),
  ('campus-navidad-2026', 'Intensivo de Navidad 2026', 'campus', 'Diciembre 2026',
   'Gracias por inscribirte al **Intensivo de Navidad 2026**. Tenis, juegos y mucho ambiente entre Navidad y Reyes.',
   20),
  ('campus-semana-santa-2026', 'Intensivo de Semana Santa 2026', 'campus', '30 marzo - 3 abril 2026',
   'Gracias por inscribirte al **Intensivo de Semana Santa 2026**. Cinco días para que no pierda ritmo.',
   30)
on conflict (slug) do nothing;
