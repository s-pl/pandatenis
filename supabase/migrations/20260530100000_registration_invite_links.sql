-- Fichas iniciadas desde el panel: el admin crea una pre-inscripcion minima
-- y comparte un enlace privado para que la familia complete todos los datos.

alter table public.registrations
  add column if not exists registration_source text not null default 'public_web'
    check (registration_source in ('public_web', 'admin_link')),
  add column if not exists invite_token text,
  add column if not exists invite_status text not null default 'completed'
    check (invite_status in ('draft', 'sent', 'completed', 'expired')),
  add column if not exists invite_created_at timestamptz,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_completed_at timestamptz,
  add column if not exists admin_notes text;

create unique index if not exists registrations_invite_token_uniq
  on public.registrations (invite_token)
  where invite_token is not null;

create index if not exists registrations_invite_status_idx
  on public.registrations (invite_status, submitted_at desc);

update public.registrations
set
  registration_source = coalesce(registration_source, 'public_web'),
  invite_status = coalesce(invite_status, 'completed')
where registration_source is null or invite_status is null;
