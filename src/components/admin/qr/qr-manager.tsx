"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, ExternalLink, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type QrCampaign = {
  slug: string;
  name: string;
  hint: string;
  url: string;
  configured: boolean;
};

export function QrManager({ campaigns }: { campaigns: QrCampaign[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {campaigns.map((campaign) => (
        <QrCard key={campaign.slug} campaign={campaign} />
      ))}
    </div>
  );
}

function QrCard({ campaign }: { campaign: QrCampaign }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    // Alta resolución y corrección 'H' para impresión sobre materiales físicos.
    QRCode.toDataURL(campaign.url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 1024,
      color: { dark: "#0e2a1f", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [campaign.url]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-campus-${campaign.slug}.png`;
    a.click();
  }

  function print() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) {
      toast.error("Permite las ventanas emergentes para imprimir");
      return;
    }
    w.document.write(
      `<!doctype html><html><head><title>${campaign.name}</title>` +
        `<style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;color:#0e2a1f}` +
        `img{width:70vmin;height:auto}h1{font-size:18px;margin:24px 0 4px}p{margin:0;color:#5b6b62;font-size:12px}</style></head>` +
        `<body><img src="${dataUrl}" alt="${campaign.name}"/><h1>${campaign.name}</h1><p>${campaign.url}</p>` +
        `<script>window.onload=function(){window.print()}</script></body></html>`,
    );
    w.document.close();
  }

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-bold text-[var(--ink)]">{campaign.name}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">{campaign.hint}</p>
        </div>
        {!campaign.configured && (
          <Badge tone="warning" className="shrink-0">
            Falta origen
          </Badge>
        )}
      </div>

      <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-white p-3">
        {error ? (
          <span className="px-4 text-center text-[12px] text-[var(--danger)]">
            No se pudo generar el QR
          </span>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`QR ${campaign.name}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[12px] text-[var(--muted)]">Generando…</span>
        )}
      </div>

      <a
        href={campaign.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center gap-1.5 truncate text-[11.5px] font-semibold text-[var(--primary)] hover:underline"
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        <span className="truncate">{campaign.url}</span>
      </a>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="accent"
          size="sm"
          iconLeft={<Download className="h-4 w-4" />}
          onClick={download}
          disabled={!dataUrl}
          className="flex-1"
        >
          Descargar PNG
        </Button>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Printer className="h-4 w-4" />}
          onClick={print}
          disabled={!dataUrl}
        >
          Imprimir
        </Button>
      </div>
    </section>
  );
}
