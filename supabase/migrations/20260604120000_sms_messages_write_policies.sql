-- Faltaban políticas de escritura en sms_messages.
--
-- La tabla tenía RLS activado y solo una política de SELECT para staff, así que
-- `sendAndLog()` (cliente anónimo + sesión del admin, sujeto a RLS) no podía
-- insertar el registro previo al envío: el INSERT lo rechazaba RLS y el SMS
-- nunca llegaba a enviarse. Añadimos INSERT y UPDATE para staff.

drop policy if exists "sms_messages_staff_insert" on public.sms_messages;
create policy "sms_messages_staff_insert" on public.sms_messages
  for insert with check (public.is_admin());

drop policy if exists "sms_messages_staff_update" on public.sms_messages;
create policy "sms_messages_staff_update" on public.sms_messages
  for update using (public.is_admin()) with check (public.is_admin());
