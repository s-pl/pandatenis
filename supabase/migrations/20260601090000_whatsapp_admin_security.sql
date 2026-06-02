-- WhatsApp operational security hardening.
-- Keep UI actions authenticated through requireAdmin(), but restrict the queue
-- claiming primitive and conversation metadata to administrators/service role.

drop policy if exists "whatsapp conversations read authenticated" on public.whatsapp_conversations;
drop policy if exists "whatsapp conversations admin read" on public.whatsapp_conversations;

create policy "whatsapp conversations admin read" on public.whatsapp_conversations
  for select to authenticated using (public.is_admin());

revoke execute on function public.claim_whatsapp_queue(integer, text, text) from public;
revoke execute on function public.claim_whatsapp_queue(integer, text, text) from anon;
revoke execute on function public.claim_whatsapp_queue(integer, text, text) from authenticated;
grant execute on function public.claim_whatsapp_queue(integer, text, text) to service_role;
