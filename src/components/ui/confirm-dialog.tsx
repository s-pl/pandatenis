"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  /** Body content rendered between description and the confirm button */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual variant — `danger` for destructive actions (red CTA), `accent` for regular confirmations */
  variant?: "danger" | "accent";
  icon?: ReactNode;
  loading?: boolean;
}

/**
 * Mobile-first confirmation dialog. Replaces native `window.confirm()` which
 * has terrible UX on touch (small buttons, ugly system style, can't be
 * styled).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "danger",
  icon,
  loading: externalLoading,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading ?? internalLoading;

  async function handleConfirm() {
    if (loading) return;
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  }

  const defaultIcon =
    variant === "danger" ? (
      <Trash2 className="h-5 w-5 text-[var(--danger)]" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />
    );

  const defaultLabel = variant === "danger" ? "Eliminar" : "Confirmar";

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "accent"}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmLabel ?? defaultLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${
            variant === "danger" ? "bg-[var(--danger-soft)]" : "bg-[var(--warning-soft)]"
          }`}
        >
          {icon ?? defaultIcon}
        </span>
        <div className="min-w-0 flex-1 text-[13.5px]">
          {description && (
            <p className="text-[var(--muted)]">{description}</p>
          )}
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </Modal>
  );
}
