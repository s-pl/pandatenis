import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";

export type ReceiptCardModel = {
  /** Mes correspondiente al recibo. */
  monthDate: string; // ISO (yyyy-mm-dd)
  studentName?: string | null;
  amount?: number | null;
  paidAt?: string | null;
  receiptNumber?: string | null;
  schoolName?: string | null;
};

const COPY = {
  es: {
    concept: "RECIBO DE PAGO EN CONCEPTO DE",
    school: "ESCUELA DE TENIS",
    month: "MES",
    stamp: "PAGADO",
    student: "Alumno/a",
    paidOn: "Fecha de pago",
    amount: "Importe abonado",
    number: "Nº de recibo",
  },
  en: {
    concept: "PAYMENT RECEIPT FOR",
    school: "TENNIS SCHOOL",
    month: "MONTH",
    stamp: "PAID",
    student: "Student",
    paidOn: "Payment date",
    amount: "Amount paid",
    number: "Receipt no.",
  },
} as const;

export function ReceiptCard({
  locale,
  model,
}: {
  locale: "es" | "en";
  model: ReceiptCardModel;
}) {
  const c = COPY[locale];
  const dfLocale = locale === "en" ? enUS : es;
  const month = format(new Date(`${model.monthDate}T00:00:00`), "LLLL yyyy", {
    locale: dfLocale,
  }).toUpperCase();
  const paid = model.paidAt
    ? format(new Date(model.paidAt), "d LLLL yyyy", { locale: dfLocale })
    : null;
  const amount =
    model.amount != null
      ? new Intl.NumberFormat(locale === "en" ? "en-GB" : "es-ES", {
          style: "currency",
          currency: "EUR",
        }).format(model.amount)
      : null;

  return (
    <div className="receipt-card">
      {/* Marca de agua: logo Panda */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="receipt-watermark" src="/panda/logo.png" alt="" aria-hidden />

      {/* Sello PAGADO */}
      <span className="receipt-stamp">{c.stamp}</span>

      <div className="receipt-body">
        <p className="receipt-concept">{c.concept}</p>
        <p className="receipt-school">{c.school}</p>
        <p className="receipt-month">
          {c.month} {month}
        </p>

        <dl className="receipt-meta">
          {model.studentName && (
            <div>
              <dt>{c.student}</dt>
              <dd>{model.studentName}</dd>
            </div>
          )}
          {paid && (
            <div>
              <dt>{c.paidOn}</dt>
              <dd>{paid}</dd>
            </div>
          )}
          {amount && (
            <div>
              <dt>{c.amount}</dt>
              <dd>{amount}</dd>
            </div>
          )}
          {model.receiptNumber && (
            <div>
              <dt>{c.number}</dt>
              <dd>{model.receiptNumber}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
