-- Migración: WhatsApp Business Cloud API (Meta) — sustituye al bridge whatsapp-web.js.
--
-- Aporta los campos necesarios para mapear plantillas a la estructura que exige
-- Meta (idioma + components con header/body/footer/buttons + estado de aprobación)
-- y prepara whatsapp_messages para guardar metadatos específicos del proveedor.
--
-- meta_template_name ya es UNIQUE desde la migración inicial → se reutiliza tal cual
-- como identificador en Meta (el "name" que se manda en el payload del template).

alter table public.message_templates
  add column if not exists language text not null default 'es_ES',
  add column if not exists components_schema jsonb,
  add column if not exists meta_status text not null default 'pending'
    check (meta_status in ('pending', 'approved', 'rejected'));

-- Migrar el booleano legacy "approved" a "meta_status" preservando los datos existentes.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'message_templates' and column_name = 'approved'
  ) then
    update public.message_templates
      set meta_status = case when approved then 'approved' else 'pending' end;
    alter table public.message_templates drop column approved;
  end if;
end $$;

alter table public.whatsapp_messages
  add column if not exists provider text not null default 'meta',
  add column if not exists template_language text,
  add column if not exists template_variables jsonb,
  add column if not exists meta_conversation_id text,
  add column if not exists meta_pricing_category text;

-- Índice para detectar la ventana 24h de cada teléfono.
create index if not exists idx_whatsapp_messages_inbound_window
  on public.whatsapp_messages (recipient_phone, created_at desc)
  where direction = 'inbound';

comment on column public.message_templates.language is
  'Código de idioma BCP-47 que coincide con la plantilla aprobada en Meta (ej. es_ES, es).';

comment on column public.message_templates.components_schema is
  'Estructura JSON de la plantilla Meta: {header?, body, footer?, buttons?} con sus parameters.';

comment on column public.message_templates.meta_status is
  'Estado de aprobación en Meta: pending | approved | rejected.';

comment on column public.whatsapp_messages.provider is
  'Proveedor usado para entregar el mensaje. Por defecto "meta".';

comment on column public.whatsapp_messages.template_variables is
  'Valores de las variables que se sustituyeron al renderizar la plantilla.';
