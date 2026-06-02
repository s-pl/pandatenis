"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Fallback reutilizable para los `error.tsx` del admin. Registra el error en
 * consola, muestra un mensaje amable con la referencia (digest) y un botón para
 * reintentar el segmento que falló sin recargar todo el panel.
 */
export function AdminErrorState({
  error,
  reset,
  title,
  description,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  const t = useTranslations("admin.error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <div className="max-w-sm">
        <h2 className="text-[18px] font-bold text-foreground">{title ?? t("title")}</h2>
        <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--muted)]">
          {description ?? t("description")}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">ref: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} iconLeft={<RotateCw className="h-4 w-4" />}>
        {t("retry")}
      </Button>
    </div>
  );
}
