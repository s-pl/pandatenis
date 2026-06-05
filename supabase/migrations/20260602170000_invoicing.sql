-- Facturación profesional para España.
--
-- Objetivos:
--   1. Datos fiscales completos del emisor (NIF obligatorio en factura).
--   2. IVA configurable por recibo: exento (Art. 20 LIVA) o 21/10/4 %.
--      El importe guardado en payments.amount es el TOTAL que paga la familia
--      (IVA incluido); la base imponible y la cuota se derivan del tipo.
--   3. Documento emitido inmutable y trazable: al cobrar un recibo se congela
--      un snapshot fiscal (número correlativo, base, cuota, total y datos del
--      emisor) que no cambia aunque después se editen los ajustes.

-- 1) Datos fiscales del emisor ------------------------------------------------
alter table public.school_settings
  add column if not exists fiscal_nif text,
  add column if not exists fiscal_email text,
  add column if not exists fiscal_phone text,
  add column if not exists invoice_footer text;

comment on column public.school_settings.fiscal_nif is
  'NIF/CIF del emisor. Obligatorio en cualquier factura emitida en España.';
comment on column public.school_settings.invoice_footer is
  'Nota libre que aparece al pie de cada factura (condiciones, agradecimiento, etc.).';

-- 2) IVA por recibo -----------------------------------------------------------
alter table public.payments
  add column if not exists vat_rate numeric(5, 2) not null default 0,
  add column if not exists vat_exempt boolean not null default true;

comment on column public.payments.vat_rate is
  'Tipo de IVA aplicado (0, 4, 10 o 21). Se ignora si vat_exempt = true.';
comment on column public.payments.vat_exempt is
  'true = operación exenta (Art. 20 LIVA). En ese caso base = total y cuota = 0.';

-- 3) Snapshot fiscal inmutable en el documento emitido ------------------------
alter table public.receipts
  add column if not exists concept text,
  add column if not exists base_amount numeric(10, 2),
  add column if not exists vat_rate numeric(5, 2),
  add column if not exists vat_amount numeric(10, 2),
  add column if not exists total_amount numeric(10, 2),
  add column if not exists vat_exempt boolean,
  add column if not exists issuer jsonb;

comment on column public.receipts.issuer is
  'Datos fiscales del emisor congelados en el momento de emitir el documento.';

-- 4) Trigger de emisión -------------------------------------------------------
-- Recalcula el desglose fiscal y congela el emisor. Se dispara tanto al pasar
-- un recibo a "pagado" (update) como al crearlo ya pagado (insert), de modo que
-- todo cobro genera su número correlativo sin huecos (secuencia dedicada).
create or replace function public.create_receipt_for_paid_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text;
  next_number bigint;
  doc_number text;
  s record;
  v_total numeric(10, 2);
  v_base numeric(10, 2);
  v_vat numeric(10, 2);
  v_rate numeric(5, 2);
  v_exempt boolean;
begin
  if new.status = 'pagado' and (tg_op = 'INSERT' or old.status is distinct from 'pagado') then
    select * into s from public.school_settings where id = true;
    prefix := coalesce(s.receipt_prefix, 'PT');
    next_number := nextval('public.receipt_number_seq');
    doc_number := prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 4, '0');

    v_total := new.amount;
    v_exempt := coalesce(new.vat_exempt, true);
    v_rate := coalesce(new.vat_rate, 0);

    if v_exempt or v_rate = 0 then
      if v_exempt then v_rate := 0; end if;
      v_base := v_total;
      v_vat := 0;
    else
      v_base := round(v_total / (1 + v_rate / 100), 2);
      v_vat := v_total - v_base;
    end if;

    insert into public.receipts (
      payment_id, receipt_number, concept,
      base_amount, vat_rate, vat_amount, total_amount, vat_exempt, issuer
    )
    values (
      new.id, doc_number, new.concept,
      v_base, v_rate, v_vat, v_total, v_exempt,
      jsonb_build_object(
        'school_name', s.school_name,
        'fiscal_name', s.fiscal_name,
        'fiscal_nif', s.fiscal_nif,
        'fiscal_address', s.fiscal_address,
        'fiscal_email', s.fiscal_email,
        'fiscal_phone', s.fiscal_phone,
        'invoice_footer', s.invoice_footer
      )
    )
    on conflict (payment_id) do nothing;

    insert into public.student_timeline_events (student_id, title, detail, type)
    values (new.student_id, 'Pago marcado como pagado', new.concept || ' - ' || new.amount::text || ' EUR', 'pago');
  end if;
  return new;
end;
$$;

drop trigger if exists paid_payment_receipt on public.payments;
create trigger paid_payment_receipt
  after insert or update of status on public.payments
  for each row execute function public.create_receipt_for_paid_payment();
