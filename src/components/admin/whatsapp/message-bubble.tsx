"use client";

import { Check, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

type BubbleStatus = "draft" | "sent" | "delivered";

export function MessageBubble({
  text,
  status = "draft",
  timestamp,
  highlightVariables = false,
  className,
}: {
  text: string;
  status?: BubbleStatus;
  timestamp?: string;
  highlightVariables?: boolean;
  className?: string;
}) {
  const segments = highlightVariables ? splitWithVariables(text) : [{ text, variable: false }];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={
        "relative max-w-md rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-2.5 text-sm text-[#0b1f0e] shadow-[0_1px_1px_rgba(0,0,0,0.08)] " +
        (className ?? "")
      }
    >
      <p className="whitespace-pre-wrap leading-relaxed">
        {segments.map((segment, idx) =>
          segment.variable ? (
            <span
              key={idx}
              className="rounded-md bg-[#1f6f43]/15 px-1 font-medium text-[#1f6f43]"
            >
              {segment.text}
            </span>
          ) : (
            <span key={idx}>{segment.text}</span>
          ),
        )}
      </p>
      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#1f4a26]/70">
        {timestamp && <span>{timestamp}</span>}
        {status === "sent" && <Check className="h-3 w-3" />}
        {status === "delivered" && <CheckCheck className="h-3 w-3 text-[#0a6ed1]" />}
      </div>
      <span
        className="absolute -top-px right-[-6px] h-3 w-3 bg-[#dcf8c6]"
        style={{
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
        aria-hidden
      />
    </motion.div>
  );
}

export function ChatPreviewFrame({
  children,
  contactName = "Familia ejemplo",
}: {
  children: React.ReactNode;
  contactName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] shadow-[var(--shadow-md)]">
      <header className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
        <div className="relative h-9 w-9 overflow-hidden rounded-full bg-white">
          <Image src="/panda/logo.png" alt="" fill sizes="36px" className="object-contain" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">{contactName}</p>
          <p className="text-[11px] text-white/70">en línea</p>
        </div>
      </header>
      <div
        className="flex flex-col items-end gap-2 p-4"
        style={{
          background:
            "repeating-linear-gradient(45deg, #efeae2 0 12px, #ebe4d8 12px 24px)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function splitWithVariables(text: string): Array<{ text: string; variable: boolean }> {
  const pattern = /\{\{(\d+|[a-zA-Z_]\w*)\}\}/g;
  const result: Array<{ text: string; variable: boolean }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      result.push({ text: text.slice(lastIndex, match.index), variable: false });
    }
    result.push({ text: match[0], variable: true });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex), variable: false });
  }
  return result;
}
