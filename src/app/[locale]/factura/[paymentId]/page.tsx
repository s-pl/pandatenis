import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { computeInvoiceAmounts } from "@/lib/invoice";
import { InvoiceDocument, type InvoiceModel } from "@/components/invoice/invoice-document";
import { InvoiceToolbar } from "@/components/invoice/invoice-toolbar";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; paymentId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { paymentId } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("receipts")
    .select("receipt_number")
    .eq("payment_id", paymentId)
    .maybeSingle();
  return { title: data?.receipt_number ? `Factura ${data.receipt_number}` : "Factura (proforma)" };
}

type IssuerSnapshot = {
  school_name?: string | null;
  fiscal_name?: string | null;
  fiscal_nif?: string | null;
  fiscal_address?: string | null;
  fiscal_email?: string | null;
  fiscal_phone?: string | null;
  invoice_footer?: string | null;
};

export default async function InvoicePage({ params }: PageProps) {
  const { paymentId } = await params;
  const { supabase } = await requireAdmin();

  const [paymentRes, receiptRes, settingsRes] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, concept, amount, due_date, paid_at, status, method, vat_rate, vat_exempt, students(first_name, last_name, address, guardians(full_name))",
      )
      .eq("id", paymentId)
      .maybeSingle(),
    supabase
      .from("receipts")
      .select(
        "receipt_number, generated_at, concept, base_amount, vat_rate, vat_amount, total_amount, vat_exempt, issuer",
      )
      .eq("payment_id", paymentId)
      .maybeSingle(),
    supabase
      .from("school_settings")
      .select("school_name, fiscal_name, fiscal_nif, fiscal_address, fiscal_email, fiscal_phone, invoice_footer")
      .maybeSingle(),
  ]);

  const payment = paymentRes.data;
  if (!payment) notFound();

  const receipt = receiptRes.data;
  const settings = settingsRes.data;

  const student = Array.isArray(payment.students) ? payment.students[0] : payment.students;
  const guardianRaw = student?.guardians;
  const guardian = Array.isArray(guardianRaw) ? guardianRaw[0] : guardianRaw;

  // El emisor congelado en el recibo manda; si aún no se ha emitido, usamos los
  // ajustes actuales (proforma).
  const snapshot = (receipt?.issuer ?? null) as IssuerSnapshot | null;
  const issuer = {
    schoolName: snapshot?.school_name ?? settings?.school_name ?? "Asociación Panda Tenis",
    fiscalName: snapshot?.fiscal_name ?? settings?.fiscal_name ?? "",
    nif: snapshot?.fiscal_nif ?? settings?.fiscal_nif ?? "",
    address: snapshot?.fiscal_address ?? settings?.fiscal_address ?? "",
    email: snapshot?.fiscal_email ?? settings?.fiscal_email ?? "",
    phone: snapshot?.fiscal_phone ?? settings?.fiscal_phone ?? "",
    footer: snapshot?.invoice_footer ?? settings?.invoice_footer ?? "",
  };

  const amounts = receipt
    ? {
        base: Number(receipt.base_amount ?? payment.amount),
        vat: Number(receipt.vat_amount ?? 0),
        total: Number(receipt.total_amount ?? payment.amount),
        rate: Number(receipt.vat_rate ?? 0),
        exempt: receipt.vat_exempt ?? true,
      }
    : computeInvoiceAmounts(Number(payment.amount), payment.vat_exempt ?? true, Number(payment.vat_rate ?? 0));

  const invoice: InvoiceModel = {
    number: receipt?.receipt_number ?? null,
    issuedAt: receipt?.generated_at ?? payment.paid_at ?? new Date().toISOString(),
    isProforma: !receipt,
    issuer,
    customer: {
      studentName: student ? `${student.first_name} ${student.last_name}` : "—",
      guardianName: guardian?.full_name ?? null,
      address: student?.address ?? null,
    },
    concept: receipt?.concept ?? payment.concept,
    base: amounts.base,
    vatRate: amounts.rate,
    vat: amounts.vat,
    total: amounts.total,
    exempt: amounts.exempt,
    payment: {
      status: payment.status as "pagado" | "pendiente" | "atrasado",
      method: payment.method as "efectivo" | "transferencia" | "bizum" | null,
      paidAt: payment.paid_at,
    },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#e9eeec", colorScheme: "light", paddingBottom: 48 }}>
      <InvoiceToolbar title={invoice.number ? `Factura ${invoice.number}` : "Proforma"} />
      <div className="invoice-print-area" style={{ padding: "0 12px" }}>
        <div style={{ boxShadow: "0 12px 40px -16px rgba(14,42,31,0.35)", borderRadius: 6, overflow: "hidden" }}>
          <InvoiceDocument invoice={invoice} />
        </div>
      </div>
    </div>
  );
}
