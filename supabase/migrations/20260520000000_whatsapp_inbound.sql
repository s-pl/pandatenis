-- Soporte para conversaciones bidireccionales en whatsapp_messages.
-- Distingue entre mensajes salientes (los que el panel envía) y entrantes
-- (los que llegan a través del bridge whatsapp-web.js).

alter table public.whatsapp_messages
  add column if not exists direction text not null default 'outbound'
    check (direction in ('outbound', 'inbound')),
  add column if not exists body_text text,
  add column if not exists read_at timestamptz;

-- Permite hacer related_type opcional para mensajes entrantes (no siempre encajan
-- en una categoría conocida; los inbound los catalogamos como 'promocion' por defecto).
alter table public.whatsapp_messages
  alter column related_type drop not null;

-- Índice para listar conversaciones rápido (por teléfono, último mensaje primero).
create index if not exists whatsapp_messages_phone_created_at_idx
  on public.whatsapp_messages (recipient_phone, created_at desc);

-- Índice para filtrar entrantes no leídos.
create index if not exists whatsapp_messages_unread_inbound_idx
  on public.whatsapp_messages (recipient_phone)
  where direction = 'inbound' and read_at is null;

-- Evita duplicar mensajes entrantes si el bridge reenvía el mismo external id.
create unique index if not exists whatsapp_messages_provider_message_id_uniq
  on public.whatsapp_messages (provider_message_id)
  where provider_message_id is not null and direction = 'inbound';
