// Cálculo y vocabulario fiscal de las facturas (España).
//
// Regla de negocio: el importe que se teclea en un recibo es el TOTAL que paga
// la familia (IVA incluido). La base imponible y la cuota se derivan del tipo.

export type VatChoice = "exento" | "21" | "10" | "4";

export const VAT_OPTIONS: { value: VatChoice; label: string; vatExempt: boolean; vatRate: number }[] = [
  { value: "exento", label: "Exento (Art. 20 LIVA)", vatExempt: true, vatRate: 0 },
  { value: "21", label: "21 % (general)", vatExempt: false, vatRate: 21 },
  { value: "10", label: "10 % (reducido)", vatExempt: false, vatRate: 10 },
  { value: "4", label: "4 % (superreducido)", vatExempt: false, vatRate: 4 },
];

/** Texto legal que debe figurar en una factura exenta. */
export const VAT_EXEMPTION_NOTE =
  "Operación exenta de IVA conforme al artículo 20.Uno.13.º de la Ley 37/1992 del IVA " +
  "(servicios deportivos y de educación física prestados por una entidad sin ánimo de lucro).";

export function vatChoiceFor(vatExempt: boolean, vatRate: number): VatChoice {
  if (vatExempt) return "exento";
  if (vatRate === 21) return "21";
  if (vatRate === 10) return "10";
  if (vatRate === 4) return "4";
  return "exento";
}

export function vatChoiceToFields(choice: VatChoice): { vatExempt: boolean; vatRate: number } {
  const option = VAT_OPTIONS.find((o) => o.value === choice) ?? VAT_OPTIONS[0];
  return { vatExempt: option.vatExempt, vatRate: option.vatRate };
}

export type InvoiceAmounts = {
  /** Base imponible. */
  base: number;
  /** Cuota de IVA. */
  vat: number;
  /** Total con IVA incluido (lo que paga la familia). */
  total: number;
  /** Tipo aplicado (0 si exento). */
  rate: number;
  exempt: boolean;
};

/** Deriva base + cuota a partir del total IVA incluido. */
export function computeInvoiceAmounts(total: number, vatExempt: boolean, vatRate: number): InvoiceAmounts {
  if (vatExempt || vatRate === 0) {
    return { base: round2(total), vat: 0, total: round2(total), rate: 0, exempt: vatExempt };
  }
  const base = round2(total / (1 + vatRate / 100));
  return { base, vat: round2(total - base), total: round2(total), rate: vatRate, exempt: false };
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
