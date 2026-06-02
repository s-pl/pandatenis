"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({
  url,
  label = "Copiar enlace",
  variant = "secondary",
}: {
  url: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "accent";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar", { description: url });
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={copy}
      iconLeft={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    >
      {copied ? "Copiado" : label}
    </Button>
  );
}
