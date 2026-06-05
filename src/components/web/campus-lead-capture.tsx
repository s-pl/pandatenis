"use client";

import { useState, useTransition, type FormEvent } from "react";
import { captureCampusLeadAction } from "@/lib/web/lead-capture";

type Lang = "es" | "en";

const COPY = {
  es: {
    formTitle: "¿Te llamamos?",
    formHint: "Déjanos tus datos y abrimos WhatsApp para enviarte la información del Campus.",
    name: "Tu nombre",
    namePlaceholder: "Nombre y apellidos",
    phone: "Teléfono",
    phonePlaceholder: "600 123 456",
    submit: "Continuar a WhatsApp",
    sending: "Abriendo…",
    back: "Cambiar idioma",
    errorGeneric: "No se pudo continuar. Inténtalo de nuevo.",
    redirecting: "Abriendo WhatsApp…",
    openManually: "Si no se abre automáticamente, pulsa aquí",
  },
  en: {
    formTitle: "Shall we contact you?",
    formHint: "Leave your details and we'll open WhatsApp to send you the Camp information.",
    name: "Your name",
    namePlaceholder: "Full name",
    phone: "Phone",
    phonePlaceholder: "+34 600 123 456",
    submit: "Continue to WhatsApp",
    sending: "Opening…",
    back: "Change language",
    errorGeneric: "Could not continue. Please try again.",
    redirecting: "Opening WhatsApp…",
    openManually: "If it doesn't open automatically, tap here",
  },
} as const;

export function CampusLeadCapture({
  sourceSlug,
  campaignLabel,
}: {
  sourceSlug: string;
  campaignLabel: string;
}) {
  const [lang, setLang] = useState<Lang | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lang) return;
    setError(null);
    startTransition(async () => {
      const result = await captureCampusLeadAction({
        sourceSlug,
        locale: lang,
        fullName,
        phone,
        company,
      });
      if (result.ok) {
        setWhatsappUrl(result.whatsappUrl);
        // Abre WhatsApp conservando el gesto del usuario (mismo tab).
        window.location.href = result.whatsappUrl;
      } else {
        setError(result.error || COPY[lang].errorGeneric);
      }
    });
  }

  // Pantalla de redirección (lead ya guardado).
  if (whatsappUrl) {
    const c = COPY[lang ?? "es"];
    return (
      <div className="campus-landing-card text-center">
        <p className="text-[15px] font-semibold text-[var(--forest)]">{c.redirecting}</p>
        <a className="campus-landing-cta mt-5" href={whatsappUrl}>
          WhatsApp
        </a>
        <p className="mt-3 text-[12.5px] text-[var(--forest-soft)]">{c.openManually}</p>
      </div>
    );
  }

  // Pantalla 1 — selección de idioma (bilingüe).
  if (!lang) {
    return (
      <div className="campus-landing-card text-center">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--coral-deep)]">
          {campaignLabel}
        </p>
        <h1 className="mt-3 headline text-[clamp(1.6rem,6vw,2.4rem)] text-[var(--forest)]">
          SELECT LANGUAGE
          <span className="block text-[var(--forest-soft)]">SELECCIONE IDIOMA</span>
        </h1>
        <div className="mt-7 grid gap-3">
          <button type="button" className="campus-landing-lang" onClick={() => setLang("es")}>
            🇪🇸 Español
          </button>
          <button type="button" className="campus-landing-lang" onClick={() => setLang("en")}>
            🇬🇧 English
          </button>
        </div>
      </div>
    );
  }

  // Pantalla 2 — mini formulario en el idioma elegido.
  const c = COPY[lang];
  return (
    <div className="campus-landing-card">
      <button
        type="button"
        onClick={() => {
          setLang(null);
          setError(null);
        }}
        className="text-[12.5px] font-semibold text-[var(--forest-soft)] underline underline-offset-4"
      >
        ← {c.back}
      </button>
      <h1 className="mt-4 headline text-[clamp(1.5rem,5vw,2.1rem)] text-[var(--forest)]">
        {c.formTitle}
      </h1>
      <p className="mt-2 text-[14px] leading-[1.7] text-[var(--forest-soft)]">{c.formHint}</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-[12.5px] font-bold text-[var(--forest)]">{c.name}</span>
          <input
            className="campus-landing-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={c.namePlaceholder}
            autoComplete="name"
            required
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[12.5px] font-bold text-[var(--forest)]">{c.phone}</span>
          <input
            className="campus-landing-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={c.phonePlaceholder}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </label>

        {/* Honeypot anti-bots: oculto para personas. */}
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        {error && (
          <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--danger)]">
            {error}
          </p>
        )}

        <button type="submit" className="campus-landing-cta" disabled={pending}>
          {pending ? c.sending : c.submit}
        </button>
      </form>
    </div>
  );
}
