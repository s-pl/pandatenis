-- Metadatos para hacer el envío por WhatsApp tolerante a fallos transitorios.
-- Los mensajes permanecen en cola cuando el bridge se reinicia o WhatsApp Web
-- no está listo, y se reintentan con backoff sin perder trazabilidad.

alter table public.whatsapp_messages
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz;

alter table public.whatsapp_messages
  add constraint whatsapp_messages_attempt_count_non_negative
    check (attempt_count >= 0);

create index if not exists whatsapp_messages_queue_idx
  on public.whatsapp_messages (status, next_attempt_at, created_at)
  where status = 'queued';
