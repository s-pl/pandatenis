-- Habilita Supabase Realtime para las tablas que el panel admin necesita
-- escuchar en tiempo real (sustituye el polling cada 5 s a /api/whatsapp/unread-summary
-- y los router.refresh() en chats-list / chat-room).

alter publication supabase_realtime add table public.whatsapp_messages;
alter publication supabase_realtime add table public.whatsapp_conversations;

comment on publication supabase_realtime is
  'Tablas con Realtime habilitado. Los clientes admin se suscriben a INSERT/UPDATE para sustituir polling.';
