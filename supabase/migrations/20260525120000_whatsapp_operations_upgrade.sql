-- Mejora operativa de WhatsApp Cloud API:
-- plantillas sincronizadas, cola robusta, conversaciones, opt-out y media persistida.

alter type public.message_status add value if not exists 'read';

alter table public.message_templates
  add column if not exists meta_template_id text,
  add column if not exists meta_review_status text,
  add column if not exists meta_rejection_reason text,
  add column if not exists meta_quality_score text,
  add column if not exists meta_synced_at timestamptz;

create unique index if not exists message_templates_meta_template_id_uniq
  on public.message_templates (meta_template_id)
  where meta_template_id is not null;

alter table public.whatsapp_messages
  add column if not exists max_attempts integer not null default 7,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists dead_letter_at timestamptz,
  add column if not exists retry_after_at timestamptz,
  add column if not exists error_code text,
  add column if not exists fbtrace_id text,
  add column if not exists meta_error jsonb;

alter table public.whatsapp_messages
  add constraint whatsapp_messages_max_attempts_positive
    check (max_attempts between 1 and 25);

create index if not exists whatsapp_messages_live_queue_idx
  on public.whatsapp_messages (status, next_attempt_at, locked_at, created_at)
  where status = 'queued' and dead_letter_at is null;

create index if not exists whatsapp_messages_dead_letter_idx
  on public.whatsapp_messages (dead_letter_at desc)
  where dead_letter_at is not null;

create table if not exists public.whatsapp_conversations (
  phone text primary key check (phone ~ '^\d{8,15}$'),
  display_name text,
  assignee_id uuid references public.profiles(id) on delete set null,
  tags text[] not null default '{}'::text[],
  internal_note text,
  marketing_opt_out boolean not null default false,
  opted_out_at timestamptz,
  opt_out_keyword text,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_last_message_idx
  on public.whatsapp_conversations (last_message_at desc nulls last);

create index if not exists whatsapp_conversations_tags_idx
  on public.whatsapp_conversations using gin (tags);

alter table public.whatsapp_conversations enable row level security;

drop policy if exists "whatsapp conversations read authenticated" on public.whatsapp_conversations;
drop policy if exists "whatsapp conversations admin write" on public.whatsapp_conversations;

create policy "whatsapp conversations read authenticated" on public.whatsapp_conversations
  for select to authenticated using (true);

create policy "whatsapp conversations admin write" on public.whatsapp_conversations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create trigger whatsapp_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-media',
  'whatsapp-media',
  false,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'audio/aac',
    'audio/amr',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists "whatsapp media admin read" on storage.objects;
drop policy if exists "whatsapp media admin insert" on storage.objects;
drop policy if exists "whatsapp media admin delete" on storage.objects;

create policy "whatsapp media admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'whatsapp-media' and public.is_admin());

create policy "whatsapp media admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'whatsapp-media' and public.is_admin());

create policy "whatsapp media admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'whatsapp-media' and public.is_admin());

create or replace function public.claim_whatsapp_queue(
  p_limit integer default 10,
  p_worker text default null,
  p_phone text default null
)
returns setof public.whatsapp_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_worker text := coalesce(nullif(p_worker, ''), gen_random_uuid()::text);
begin
  return query
  with picked as (
    select id
    from public.whatsapp_messages
    where status = 'queued'
      and (p_phone is null or recipient_phone = p_phone)
      and dead_letter_at is null
      and attempt_count < max_attempts
      and (next_attempt_at is null or next_attempt_at <= now())
      and (retry_after_at is null or retry_after_at <= now())
      and (locked_at is null or locked_at < now() - interval '10 minutes')
    order by created_at asc
    for update skip locked
    limit v_limit
  )
  update public.whatsapp_messages message
    set locked_at = now(),
        locked_by = v_worker
  from picked
  where message.id = picked.id
  returning message.*;
end;
$$;

grant execute on function public.claim_whatsapp_queue(integer, text, text) to authenticated;
grant execute on function public.claim_whatsapp_queue(integer, text, text) to service_role;

comment on function public.claim_whatsapp_queue(integer, text, text) is
  'Reclama mensajes queued vencidos con SKIP LOCKED para evitar dobles envíos cuando corren varios cron.';

comment on table public.whatsapp_conversations is
  'Metadatos operativos de la bandeja WhatsApp: asignación, etiquetas, notas y opt-out.';

comment on column public.whatsapp_messages.dead_letter_at is
  'Marca mensajes agotados que ya no se reintentan automáticamente.';
