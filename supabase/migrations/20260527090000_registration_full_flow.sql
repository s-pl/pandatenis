-- Full multi-step registration flow: extend registrations + leads with the
-- data captured by the new wizard (student details, medical info, signature,
-- consent and course slug). Service role bypasses RLS so no public policies
-- are required.

-- Allow the existing 'ambos' value used by the public registration form.
alter type public.lead_interest add value if not exists 'ambos';

create type public.registration_gender as enum ('masculino', 'femenino', 'otro');

alter table public.registrations
  add column if not exists course_slug text,
  add column if not exists email text,
  add column if not exists child_last_name text,
  add column if not exists child_birth_date date,
  add column if not exists child_gender public.registration_gender,
  add column if not exists family_relations jsonb not null default '[]'::jsonb,
  add column if not exists allergies text,
  add column if not exists illnesses text,
  add column if not exists injuries text,
  add column if not exists signer_first_name text,
  add column if not exists signer_last_name text,
  add column if not exists signature_data text,
  add column if not exists consent_multimedia boolean not null default false,
  add column if not exists terms_accepted_at timestamptz;

alter table public.leads
  add column if not exists email text,
  add column if not exists course_slug text;

create index if not exists registrations_course_slug_idx on public.registrations (course_slug);
create index if not exists registrations_email_idx on public.registrations (lower(email));
create index if not exists leads_email_idx on public.leads (lower(email));
