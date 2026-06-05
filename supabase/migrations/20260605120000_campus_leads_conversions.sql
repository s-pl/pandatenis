-- Campus: Leads y Conversiones.
--
-- Objetivos de esta migración:
--   1. Orígenes de entrada canónicos (con slug estable + categoría) para las
--      campañas del Campus: Carteles, Flyers, Chapas, Google/Web, Instagram,
--      Facebook, Alta manual, Recomendación, Otro. El slug es la clave que usan
--      los QR (landing /c/[source]) y el selector "¿Cómo nos conociste?".
--   2. Idioma del lead (comm_locale): se captura en la landing antes de abrir
--      WhatsApp y se hereda al alumno al convertir.
--   3. Campo "referral" en inscripciones: respuesta autodeclarada de la familia
--      a "¿Cómo nos conociste?" (comprobación cruzada de estadísticas).

-- 1) Orígenes de entrada -----------------------------------------------------
alter table public.lead_sources
  add column if not exists slug text,
  add column if not exists category text;

create unique index if not exists lead_sources_slug_key
  on public.lead_sources (slug)
  where slug is not null;

comment on column public.lead_sources.slug is
  'Clave estable del origen (usada por los QR de campaña y el selector de inscripción).';
comment on column public.lead_sources.category is
  'Agrupación del origen: campaign | organic | social | referral | manual | other.';

-- Conserva los orígenes históricos pero asegura el catálogo canónico del Campus.
-- Se hace por slug: si ya existe el nombre, se actualiza; si no, se inserta.
insert into public.lead_sources (name, slug, category) values
  ('Carteles',                  'carteles',     'campaign'),
  ('Flyers',                    'flyers',       'campaign'),
  ('Chapas promocionales',      'chapas',       'campaign'),
  ('Google / Página Web',       'google_web',   'organic'),
  ('Instagram',                 'instagram',    'social'),
  ('Facebook',                  'facebook',     'social'),
  ('Recomendación de un alumno','recomendacion','referral'),
  ('Alta manual',               'alta_manual',  'manual'),
  ('Otro',                      'otro',         'other')
on conflict (name) do update
  set slug = excluded.slug,
      category = excluded.category;

-- 2) Idioma del lead ---------------------------------------------------------
alter table public.leads
  add column if not exists comm_locale text not null default 'es'
    check (comm_locale in ('es', 'en'));

comment on column public.leads.comm_locale is
  'Idioma elegido por el lead en la landing del QR (es | en). Se hereda al alumno.';

-- 3) "¿Cómo nos conociste?" en la inscripción --------------------------------
alter table public.registrations
  add column if not exists referral text;

comment on column public.registrations.referral is
  'Respuesta autodeclarada de "¿Cómo nos conociste?" (slug del origen): comprobación cruzada de estadísticas.';
