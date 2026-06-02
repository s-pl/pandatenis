-- Idioma elegido al generar enlaces privados de inscripcion desde el panel.

alter table public.registrations
  add column if not exists invite_locale text not null default 'es'
    check (invite_locale in ('es', 'en'));

comment on column public.registrations.invite_locale is
  'Idioma del enlace privado generado desde el panel: es | en.';
