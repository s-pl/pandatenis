import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";

export type CommLocale = "es" | "en";

export function normalizeLocale(value: string | null | undefined): CommLocale {
  return value === "en" ? "en" : "es";
}

/**
 * Mes + año en el idioma del cliente. Acepta una fecha (la del recibo/pago) y
 * devuelve "mayo de 2026" (es) o "May 2026" (en).
 */
export function monthLabel(date: Date, locale: CommLocale): string {
  if (locale === "en") return format(date, "LLLL yyyy", { locale: enUS });
  return format(date, "LLLL 'de' yyyy", { locale: es });
}

/** SMS de bienvenida al pasar una inscripción a alumno (texto por defecto). */
export function welcomeSms(childName: string, locale: CommLocale): string {
  const name = childName.trim();
  return locale === "en"
    ? `Welcome to Panda Tennis${name ? `, ${name}` : ""}! We're happy to have you in the family. See you on court!`
    : `¡Bienvenid@ a Panda Tenis${name ? `, ${name}` : ""}! Nos alegra tenerte en la familia. ¡Nos vemos en pista!`;
}

/** SMS de difusión de una promoción. */
export function promoSms(title: string, link: string, locale: CommLocale): string {
  return locale === "en"
    ? `${title} Registrations now open. More information here: ${link}`
    : `${title} Inscripciones abiertas. Más información aquí: ${link}`;
}

/** SMS de confirmación de pago recibido. */
export function paymentConfirmSms(date: Date, link: string, locale: CommLocale): string {
  const month = monthLabel(date, locale);
  return locale === "en"
    ? `Panda Tennis: We have successfully received the payment corresponding to ${month}. View your receipt here: ${link}`
    : `Panda Tenis: Hemos recibido correctamente el pago correspondiente al mes de ${month}. Consulte su recibo aquí: ${link}`;
}

/** SMS recordatorio de recibo pendiente. */
export function paymentReminderSms(date: Date, locale: CommLocale): string {
  const month = monthLabel(date, locale);
  return locale === "en"
    ? `Panda Tennis: This is a reminder that the payment corresponding to ${month} is still pending.`
    : `Panda Tenis: Le recordamos que el recibo correspondiente al mes de ${month} se encuentra pendiente de pago.`;
}
