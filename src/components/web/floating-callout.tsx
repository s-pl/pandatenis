"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { CONTACT } from "@/components/web/content";
import { BallMark } from "@/components/web/brand-marks";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem("panda-callout-dismissed") === "1";
}

/**
 * Friendly sticky postcard — appears after the hero, slightly tilted
 * like it was placed there by hand. Bouncy shadow, sun + coral palette,
 * trust-worthy enough for parents and fun enough for kids.
 */
export function FloatingCallout() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  const reducedMotion = useReducedMotion();
  const t = useTranslations("floatingCallout");

  useEffect(() => {
    if (typeof window === "undefined" || dismissed) return;
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const threshold = Math.max(window.innerHeight * 0.6, 480);
        setVisible(window.scrollY > threshold);
      });
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handler);
    };
  }, [dismissed]);

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("panda-callout-dismissed", "1");
    }
  }

  const show = visible && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          key="floating-callout"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[360px] -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-live="polite"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] p-4 shadow-[var(--shadow-lg)]">
            {/* Top sun strip */}
            <div className="-mx-4 -mt-4 mb-3 flex items-center justify-between bg-[var(--sun)] px-4 py-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest)]">
                {t("kicker")}
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--coral-deep)]">
                ¡GRATIS!
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--rule)] bg-[var(--grass-soft)]"
              >
                <BallMark className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[17px] font-bold leading-tight text-[var(--forest)]">
                  {t("title")}
                </p>
              </div>
            </div>

            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-between rounded-full border border-[var(--rule)] bg-[var(--coral)] px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
            >
              {t("cta")}
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </a>

            <button
              type="button"
              onClick={dismiss}
              className="absolute right-1.5 top-[48px] grid h-7 w-7 place-items-center rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] text-[var(--forest-mute)] transition-colors hover:bg-[var(--sun-soft)] hover:text-[var(--forest)]"
              aria-label={t("dismiss")}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
