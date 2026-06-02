-- Public registration + security hardening.

alter type public.lead_interest add value if not exists 'ambos';

create sequence if not exists public.receipt_number_seq;

do $$
declare
  max_number integer;
begin
  select coalesce(
    max((regexp_match(receipt_number, '-([0-9]+)$'))[1]::integer),
    0
  )
  into max_number
  from public.receipts
  where receipt_number ~ '-[0-9]+$';

  if max_number > 0 then
    perform setval('public.receipt_number_seq', max_number, true);
  else
    perform setval('public.receipt_number_seq', 1, false);
  end if;
end;
$$;

create or replace function public.create_receipt_for_paid_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text;
  next_number bigint;
  receipt_number text;
begin
  if new.status = 'pagado' and old.status is distinct from 'pagado' then
    select receipt_prefix into prefix from public.school_settings where id = true;
    next_number := nextval('public.receipt_number_seq');
    receipt_number := coalesce(prefix, 'PT') || '-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 4, '0');

    insert into public.receipts (payment_id, receipt_number)
    values (new.id, receipt_number)
    on conflict (payment_id) do nothing;

    insert into public.student_timeline_events (student_id, title, detail, type)
    values (new.student_id, 'Pago marcado como pagado', new.concept || ' - ' || new.amount::text || ' EUR', 'pago');
  end if;
  return new;
end;
$$;

drop policy if exists "leads professor read" on public.leads;
drop policy if exists "registrations read authenticated" on public.registrations;
drop policy if exists "messages read authenticated" on public.whatsapp_messages;
drop policy if exists "calendar read authenticated" on public.calendar_events;
drop policy if exists "reminders read authenticated" on public.event_reminders;

drop policy if exists "student media authenticated read" on storage.objects;
drop policy if exists "student media authenticated insert" on storage.objects;

create policy "student media scoped read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-media'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.media_assets asset
        where asset.storage_path = name
          and public.can_access_student(asset.student_id)
      )
    )
  );

create policy "student media admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'student-media' and public.is_admin());
