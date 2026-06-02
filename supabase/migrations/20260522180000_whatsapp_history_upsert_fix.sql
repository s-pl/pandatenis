-- Arreglo de ON CONFLICT al sincronizar el histórico de WhatsApp.
--
-- El índice unique anterior tenía un WHERE (parcial). Postgres exige que el destino
-- de ON CONFLICT sea un unique constraint o un unique index sin predicado parcial,
-- a menos que el cliente declare el mismo WHERE — cosa que el cliente JS de Supabase
-- no permite expresar. Lo cambiamos a un unique normal: NULLs en columnas unique
-- no causan conflicto en Postgres, así que las filas históricas sin provider_message_id
-- siguen funcionando.

drop index if exists public.whatsapp_messages_provider_message_id_uniq;

-- Limpia duplicados existentes (improbable pero posible) antes de crear el unique.
-- Conservamos el más antiguo (created_at más temprano) y descartamos el resto.
with ranked as (
  select
    id,
    row_number() over (
      partition by provider_message_id
      order by created_at asc, id asc
    ) as rn
  from public.whatsapp_messages
  where provider_message_id is not null
)
delete from public.whatsapp_messages
where id in (select id from ranked where rn > 1);

create unique index whatsapp_messages_provider_message_id_uniq
  on public.whatsapp_messages (provider_message_id);
