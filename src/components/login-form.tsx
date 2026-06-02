"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ supabaseReady }: { supabaseReady: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("login");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabaseReady) {
      setError(t("errors.backendUnavailable"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      const message = signInError.message.toLowerCase().includes("invalid")
        ? t("errors.invalid")
        : signInError.message;
      setError(message);
      toast.error(t("errors.toastTitle"), { description: message });
      return;
    }

    toast.success(t("successToast"));
    const next = params.get("next");
    // next may already include the locale prefix (set by proxy). We trust it as-is.
    router.replace(
      (next && /\/admin/.test(next) ? next : "/admin") as never,
    );
    router.refresh();
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-[var(--rule)] bg-[var(--sun)]">
          <Image src="/panda/logo.png" alt="Panda Tenis" fill sizes="48px" className="object-contain p-1" />
        </span>
        <p className="font-display text-[18px] font-extrabold leading-none text-[var(--forest)]">
          Panda<span className="text-[var(--coral)]">·</span>Tenis
        </p>
      </div>

      <span className="sticker text-[var(--grass-deep)]">
        <KeyRound aria-hidden className="h-4 w-4" strokeWidth={2} />
        Acceso · Equipo
      </span>
      <h2 className="mt-4 headline text-[clamp(1.8rem,4vw,2.4rem)] text-[var(--forest)]">
        {t("formTitle")}
      </h2>
      <p className="mt-3 text-[14.5px] text-[var(--forest-soft)]">{t("formSubtitle")}</p>

      <div className="mt-8 space-y-4">
        <Field label={t("emailLabel")} required>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="info@pandatenis.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            iconLeft={<Mail className="h-4 w-4" />}
            required
          />
        </Field>
        <Field label={t("passwordLabel")} required>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            iconLeft={<KeyRound className="h-4 w-4" />}
            required
            minLength={6}
          />
        </Field>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 rounded-2xl border-2 border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--coral-deep)]"
        >
          {error}
        </motion.div>
      )}

      <Button
        type="submit"
        loading={loading}
        size="lg"
        className="mt-6 w-full"
        iconRight={loading ? null : <ArrowRight className="h-4 w-4" />}
      >
        {loading ? t("submitting") : t("submit")}
      </Button>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">{t("support")}</p>
    </motion.form>
  );
}
