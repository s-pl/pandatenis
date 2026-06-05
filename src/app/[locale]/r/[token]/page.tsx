import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ReceiptCard, type ReceiptCardModel } from "@/components/receipt/receipt-card";
import { PrintButton } from "@/components/receipt/print-button";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; token: string }> };

export const metadata: Metadata = {
  title: "Panda Tenis · Recibo",
  robots: { index: false, follow: false },
};

type ReceiptRow = {
  receipt_number: string | null;
  total_amount: number | null;
  generated_at: string | null;
  payments: {
    due_date: string | null;
    paid_at: string | null;
    amount: number | null;
    students: { first_name: string; last_name: string } | null;
  } | null;
};

export default async function PublicReceiptPage({ params }: PageProps) {
  const { locale: rawLocale, token } = await params;
  const locale: "es" | "en" = rawLocale === "en" ? "en" : "es";

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("receipts")
    .select(
      "receipt_number, total_amount, generated_at, payments(due_date, paid_at, amount, students(first_name, last_name))",
    )
    .eq("public_token", token)
    .maybeSingle<ReceiptRow>();

  if (!data) notFound();

  const payment = data.payments;
  const student = payment?.students ?? null;
  const monthDate = payment?.due_date ?? payment?.paid_at ?? new Date().toISOString().slice(0, 10);

  const model: ReceiptCardModel = {
    monthDate: monthDate.slice(0, 10),
    studentName: student ? `${student.first_name} ${student.last_name}` : null,
    amount: data.total_amount ?? payment?.amount ?? null,
    paidAt: payment?.paid_at ?? data.generated_at ?? null,
    receiptNumber: data.receipt_number,
  };

  return (
    <div className="receipt-page">
      <div className="receipt-page-inner">
        <ReceiptCard locale={locale} model={model} />
        <PrintButton label={locale === "en" ? "Download / Print" : "Descargar / Imprimir"} />
      </div>
    </div>
  );
}
