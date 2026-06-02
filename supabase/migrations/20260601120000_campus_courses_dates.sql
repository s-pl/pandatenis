-- Fechas reales de inicio/fin para cada convocatoria de campus.
-- Permiten calcular automáticamente el estado (próximo / en curso / finalizado)
-- que se muestra en /campamentos. `dates_label` se mantiene como texto visible
-- libre; estas columnas son las que conducen el estado.

alter table public.campus_courses
  add column if not exists starts_on date;

alter table public.campus_courses
  add column if not exists ends_on date;
