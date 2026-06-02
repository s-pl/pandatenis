-- Vincula cada recibo (payment) a un campus concreto para poder gestionar
-- los pagos "campus por campus" desde /admin/campus/[slug]. La columna es
-- nullable: null = recibo de la escuela regular (comportamiento actual).
alter table public.payments
  add column if not exists campus_course_id uuid
    references public.campus_courses(id) on delete set null;

create index if not exists payments_campus_course_idx
  on public.payments (campus_course_id);

-- Cuarta tarjeta de temporada por defecto. Verano, Navidad y Semana Santa
-- ya se siembran en 20260527180000_campus_courses.sql.
insert into public.campus_courses (slug, title, kind, dates_label, intro, sort_order)
values
  ('campus-semana-blanca-2026', 'Campus de Semana Blanca 2026', 'campus', 'Febrero 2026',
   'Gracias por inscribirte al **Campus de Semana Blanca 2026**. Días de tenis y diversión durante la semana blanca.',
   25)
on conflict (slug) do nothing;
