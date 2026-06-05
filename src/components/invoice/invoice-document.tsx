import type { CSSProperties } from "react";
import { formatLongDate, formatMoney } from "@/lib/format";
import { VAT_EXEMPTION_NOTE } from "@/lib/invoice";

export type InvoiceModel = {
  /** Número correlativo; null mientras el recibo no se ha cobrado (proforma). */
  number: string | null;
  /** Fecha de emisión (ISO). */
  issuedAt: string;
  isProforma: boolean;
  issuer: {
    schoolName: string;
    fiscalName: string;
    nif: string;
    address: string;
    email: string;
    phone: string;
    footer: string;
  };
  customer: {
    studentName: string;
    guardianName: string | null;
    address: string | null;
  };
  concept: string;
  base: number;
  vatRate: number;
  vat: number;
  total: number;
  exempt: boolean;
  payment: {
    status: "pagado" | "pendiente" | "atrasado";
    method: "efectivo" | "transferencia" | "bizum" | null;
    paidAt: string | null;
  };
};

const methodLabel: Record<NonNullable<InvoiceModel["payment"]["method"]>, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia bancaria",
  bizum: "Bizum",
};

// Colores fijos (independientes del tema) para un documento limpio en pantalla
// y en papel. Verde corporativo Panda + tinta oscura sobre blanco.
const INK = "#0e2a1f";
const MUTED = "#5b6b63";
const RULE = "#d9e2dc";
const BRAND = "#25924F";

export function InvoiceDocument({ invoice }: { invoice: InvoiceModel }) {
  const { issuer, customer, payment } = invoice;
  const money = (n: number) => formatMoney(n, true);

  return (
    <div
      className="invoice-sheet"
      style={{
        boxSizing: "border-box",
        width: "210mm",
        maxWidth: "100%",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "18mm 16mm",
        background: "#fff",
        color: INK,
        fontFamily: "var(--font-ui), ui-sans-serif, system-ui, sans-serif",
        fontSize: 13,
        lineHeight: 1.5,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Cabecera: logo + emisor */}
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/panda/logo.png" alt="" width={64} height={64} style={{ display: "block", objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>
              {issuer.fiscalName || issuer.schoolName}
            </div>
            {issuer.fiscalName && issuer.schoolName && issuer.fiscalName !== issuer.schoolName && (
              <div style={{ fontSize: 12, color: MUTED }}>{issuer.schoolName}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          {issuer.nif && (
            <div>
              <strong style={{ color: INK }}>NIF:</strong> {issuer.nif}
            </div>
          )}
          {issuer.address && <div style={{ whiteSpace: "pre-line" }}>{issuer.address}</div>}
          {issuer.email && <div>{issuer.email}</div>}
          {issuer.phone && <div>{issuer.phone}</div>}
        </div>
      </header>

      <div style={{ height: 3, background: BRAND, borderRadius: 2, margin: "16px 0 22px" }} />

      {/* Título del documento + número/fecha + cliente */}
      <section style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            {invoice.isProforma ? "Factura proforma" : "Factura simplificada"}
          </h1>
          <div style={{ marginTop: 10, fontSize: 12.5 }}>
            <div style={{ color: MUTED }}>Cliente</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{customer.studentName}</div>
            {customer.guardianName && <div>Tutor/a: {customer.guardianName}</div>}
            {customer.address && <div style={{ color: MUTED, whiteSpace: "pre-line" }}>{customer.address}</div>}
          </div>
        </div>
        <table style={{ fontSize: 12.5, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ color: MUTED, padding: "2px 12px 2px 0" }}>Nº de factura</td>
              <td style={{ fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>
                {invoice.number ?? "— (sin emitir)"}
              </td>
            </tr>
            <tr>
              <td style={{ color: MUTED, padding: "2px 12px 2px 0" }}>Fecha de emisión</td>
              <td style={{ fontWeight: 600 }}>{formatLongDate(invoice.issuedAt)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Líneas */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 26, fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "#f1f6f3", color: INK }}>
            <th style={th("left")}>Concepto</th>
            <th style={th("right")}>Base imp.</th>
            <th style={th("right")}>IVA</th>
            <th style={th("right")}>Cuota</th>
            <th style={th("right")}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: `1px solid ${RULE}` }}>
            <td style={td("left")}>{invoice.concept}</td>
            <td style={td("right")}>{money(invoice.base)}</td>
            <td style={td("right")}>{invoice.exempt ? "Exento" : `${formatRate(invoice.vatRate)} %`}</td>
            <td style={td("right")}>{money(invoice.vat)}</td>
            <td style={{ ...td("right"), fontWeight: 700 }}>{money(invoice.total)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <table style={{ minWidth: 260, fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ color: MUTED, padding: "4px 16px 4px 0" }}>Base imponible</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{money(invoice.base)}</td>
            </tr>
            <tr>
              <td style={{ color: MUTED, padding: "4px 16px 4px 0" }}>
                {invoice.exempt ? "IVA (exento)" : `IVA (${formatRate(invoice.vatRate)} %)`}
              </td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{money(invoice.vat)}</td>
            </tr>
            <tr style={{ borderTop: `2px solid ${INK}` }}>
              <td style={{ padding: "8px 16px 0 0", fontWeight: 800, fontSize: 15 }}>Total</td>
              <td style={{ textAlign: "right", fontWeight: 800, fontSize: 15, paddingTop: 8 }}>
                {money(invoice.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Estado de cobro */}
      <div style={{ marginTop: 22, fontSize: 12.5, color: MUTED }}>
        {payment.status === "pagado" ? (
          <span>
            <strong style={{ color: BRAND }}>Cobrado</strong>
            {payment.method ? ` · ${methodLabel[payment.method]}` : ""}
            {payment.paidAt ? ` · ${formatLongDate(payment.paidAt)}` : ""}
          </span>
        ) : (
          <span>Pendiente de cobro</span>
        )}
      </div>

      {/* Pie */}
      <footer style={{ marginTop: "auto", paddingTop: 28, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
        {invoice.exempt && <p style={{ margin: "0 0 8px" }}>{VAT_EXEMPTION_NOTE}</p>}
        {issuer.footer && <p style={{ margin: "0 0 8px", whiteSpace: "pre-line" }}>{issuer.footer}</p>}
        {invoice.isProforma && (
          <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#b45309" }}>
            Documento proforma sin validez fiscal. La factura definitiva se emite al registrar el cobro.
          </p>
        )}
        <p style={{ margin: 0, borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
          Documento generado electrónicamente por {issuer.schoolName}.
        </p>
      </footer>
    </div>
  );
}

function th(align: "left" | "right"): CSSProperties {
  return {
    textAlign: align,
    padding: "9px 10px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };
}
function td(align: "left" | "right"): CSSProperties {
  return { textAlign: align, padding: "11px 10px", verticalAlign: "top" };
}
function formatRate(rate: number) {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2);
}
