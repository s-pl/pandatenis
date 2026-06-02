const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurPrecise = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const longDate = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});

const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "short" });

const timeLabel = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoney(amount: number, precise = false) {
  return precise ? eurPrecise.format(amount) : eur.format(amount);
}

export function formatLongDate(input: string | Date) {
  return longDate.format(toDate(input));
}

export function formatShortDate(input: string | Date) {
  return shortDate.format(toDate(input));
}

export function formatMonth(input: string | Date) {
  return monthLabel.format(toDate(input));
}

export function formatTime(input: string | Date) {
  return timeLabel.format(toDate(input));
}

export function formatPhoneEs(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("34"))
    return `+34 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  if (digits.length === 12 && digits.startsWith("00"))
    return `+${digits.slice(2)}`;
  return phone;
}

export function normalizeWhatsappNumber(phone: string, defaultCountry = "34") {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(defaultCountry) && digits.length > 10) return digits;
  if (digits.length === 9) return `${defaultCountry}${digits}`;
  return digits;
}

export function relativeTime(input: string | Date) {
  const now = Date.now();
  const ts = toDate(input).getTime();
  const diff = ts - now;
  const abs = Math.abs(diff);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  const rtf = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });
  if (abs < min) return "ahora mismo";
  if (abs < hr) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hr), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatLongDate(input);
}

export function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toDate(input: string | Date) {
  return input instanceof Date ? input : new Date(input);
}
