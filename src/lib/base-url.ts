import "server-only";

import { headers } from "next/headers";

/**
 * URL pública base de la aplicación (sin barra final).
 *
 * Prioriza una variable de entorno explícita (imprescindible en contextos sin
 * request, como el cron de recordatorios). Si no existe, la deduce de las
 * cabeceras de la request en curso.
 */
export async function appBaseUrl(): Promise<string> {
  const fromEnv =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "http://localhost:3000";
  }
}
