-- Permitir sincronizar el histórico completo de WhatsApp Web en whatsapp_messages.
-- Antes el unique index sólo cubría direction='inbound'. Ahora cubre ambos sentidos
-- para que el upsert por provider_message_id sirva al traer el histórico.

drop index if exists public.whatsapp_messages_provider_message_id_uniq;

create unique index whatsapp_messages_provider_message_id_uniq
  on public.whatsapp_messages (provider_message_id)
  where provider_message_id is not null;

-- Comentario informativo: payload puede contener
--   { type, hasMedia, mediaMime, mediaFilename, mediaSize, synced, reactions:[{emoji, fromMe, timestamp}] }
comment on column public.whatsapp_messages.payload is
  'JSON con metadatos: type (chat/image/video/...), mediaMime, mediaFilename, mediaSize, reactions, synced, etc.';
