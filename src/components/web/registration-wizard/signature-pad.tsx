"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
};

export function SignaturePadModal({ open, onClose, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const t = useTranslations("wizard.signature");

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    setHasDrawn(false);
  }, [open]);

  if (!open) return null;

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastRef.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    setHasDrawn(true);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    onConfirm(out.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,42,31,0.55)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 font-display text-[18px] font-extrabold text-[var(--forest)]">
            <Pencil aria-hidden className="h-4 w-4" strokeWidth={2.2} />
            {t("title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] text-[var(--forest)] hover:bg-[var(--sun-soft)]"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-[var(--forest)]/30 bg-[var(--cream-soft)]">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="block h-56 w-full touch-none"
            style={{ touchAction: "none" }}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-[var(--forest-mute)]">
          {t("hint")}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={clear}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] px-4 text-[13px] font-extrabold text-[var(--forest)] hover:bg-[var(--sun-soft)]"
          >
            <Eraser className="h-4 w-4" strokeWidth={2.2} />
            {t("clear")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!hasDrawn}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--grass)] px-5 text-[13px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[var(--shadow-sm)]"
          >
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
