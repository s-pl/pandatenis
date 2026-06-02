"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CONTACT, PANDA_IMAGES } from "@/components/web/content";
import { WhatsAppIcon } from "@/components/web/whatsapp-icon";
import { LanguageSwitcher } from "@/components/language-switcher";

const NAV_HREFS = ["/", "/campamentos", "/quienes-somos", "/inscripcion"] as const;
type NavHref = (typeof NAV_HREFS)[number];

const LABEL_KEY: Record<NavHref, string> = {
  "/": "school",
  "/campamentos": "camps",
  "/quienes-somos": "about",
  "/inscripcion": "inscription",
};

/**
 * Friendly, family-focused navigation.
 *
 * Same structure as before (logo · nav · lang · CTA) but with rounded
 * forms, the panda-tenis bouncy shadow on the CTA, and a warm white
 * shell that turns into a soft "ring" once scrolled — no harsh
 * hairlines.
 */
export function WebNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslations("nav");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (href: NavHref) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const navLinks = NAV_HREFS.filter((href) => href !== "/inscripcion");

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-[1300px] px-3 pt-3 sm:px-5 sm:pt-4">
        <nav
          className={cn(
            "relative flex h-[64px] items-center gap-3 rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] px-3 transition-shadow duration-300 sm:h-[68px] sm:px-4",
            scrolled ? "shadow-[var(--shadow-md)]" : "shadow-[var(--shadow-card)]",
          )}
        >
          {/* Logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5 pl-1.5">
            <span
              aria-hidden
              className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[var(--cream-soft)] border border-[var(--rule)] transition-transform group-hover:rotate-6"
            >
              <Image
                src={PANDA_IMAGES.logo}
                alt="Panda Tenis"
                width={40}
                height={40}
                priority
                className="h-full w-full object-contain p-1"
              />
            </span>
            <span className="leading-none">
              <span className="block font-display text-[18px] font-extrabold tracking-tight text-[var(--forest)] sm:text-[19px]">
                Panda<span className="text-[var(--coral)]">·</span>Tenis
              </span>
              <span className="mt-0.5 hidden text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--grass-deep)] sm:block">
                Mijas · Costa del Sol
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <ul className="ml-auto hidden items-center gap-1 lg:flex">
            {navLinks.map((href) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "group/link relative inline-flex h-10 items-center rounded-full px-4 text-[14.5px] font-bold transition-colors",
                      active
                        ? "bg-[var(--grass-soft)] text-[var(--grass-deep)]"
                        : "text-[var(--forest-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--forest)]",
                    )}
                  >
                    {t(LABEL_KEY[href])}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop right cluster */}
          <div className="ml-auto hidden items-center gap-2 lg:ml-0 lg:flex">
            <LanguageSwitcher variant="navbar" />
            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--coral)] pl-5 pr-2 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>{t("signUp")}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--sun)] text-[var(--forest)] transition-transform group-hover:rotate-12">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--sun)] text-[var(--forest)] shadow-[var(--shadow-sm)] transition-transform active:translate-y-[2px] active:shadow-[var(--shadow-sm)] lg:hidden"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" strokeWidth={2.4} /> : <Menu className="h-5 w-5" strokeWidth={2.4} />}
          </button>
        </nav>
      </div>

      {/* Mobile drawer — full sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-0 z-40 bg-[var(--cream)] lg:hidden"
          >
            <div className="flex h-full flex-col px-6 pb-10 pt-24 sm:px-10">
              <div className="grid gap-3">
                {navLinks.map((href, i) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] px-5 py-4 shadow-[var(--shadow-card)] transition-transform active:translate-y-[2px] active:shadow-[var(--shadow-sm)]",
                        active && "bg-[var(--grass-soft)]",
                      )}
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--sun)] text-[12px] font-extrabold text-[var(--forest)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={cn(
                            "font-display text-[26px] font-bold leading-none",
                            active ? "text-[var(--grass-deep)]" : "text-[var(--forest)]",
                          )}
                        >
                          {t(LABEL_KEY[href])}
                        </span>
                      </span>
                      <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--forest-mute)]" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-8 grid gap-3">
                <LanguageSwitcher variant="menu" />
                <a
                  href={CONTACT.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="btn btn-coral w-full justify-center"
                >
                  {t("signUp")}
                </a>
                <a
                  href={CONTACT.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost w-full justify-center"
                >
                  <WhatsAppIcon className="h-4 w-4 text-[var(--whatsapp)]" />
                  {t("whatsapp")}
                </a>
              </div>

              <div className="mt-auto pt-10 text-center">
                <p className="font-script text-[28px] text-[var(--grass-deep)]">¡Te esperamos!</p>
                <p className="mt-2 text-[12.5px] font-bold uppercase tracking-[0.12em] text-[var(--forest-mute)]">
                  Mijas · Costa del Sol
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
