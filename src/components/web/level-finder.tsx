"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { BallMark } from "@/components/web/brand-marks";
import { useMemo, useState } from "react";
import { CONTACT } from "@/components/web/content";

type LevelKey = "rojo" | "naranja" | "verde" | "amarillo";

type LevelDef = {
  key: LevelKey;
  range: [number, number];
  color: string;
  colorDeep: string;
  tint: string;
};

const LEVEL_DEFS: LevelDef[] = [
  { key: "rojo",     range: [3, 6],   color: "#F26B5E", colorDeep: "#B83E32", tint: "#FCD9D3" },
  { key: "naranja", range: [7, 9],    color: "#F39B3E", colorDeep: "#B0651A", tint: "#FCE0C0" },
  { key: "verde",   range: [10, 12],  color: "#25924F", colorDeep: "#156234", tint: "#D7EFE0" },
  { key: "amarillo", range: [13, 17], color: "#F1B934", colorDeep: "#9C7414", tint: "#FFE8A8" },
];

const AGE_RANGE = Array.from({ length: 14 }, (_, i) => i + 3);

function defForAge(age: number): LevelDef {
  return (
    LEVEL_DEFS.find((l) => age >= l.range[0] && age <= l.range[1]) ??
    LEVEL_DEFS[LEVEL_DEFS.length - 1]
  );
}

/**
 * Friendly level-finder. Same two-column layout as before — age picker
 * on the left, level result on the right — but warmer skin: rounded
 * tiles, bouncy shadows, friendly emojis. Designed for parents to
 * confirm "in qué nivel encaja mi peque" at a glance.
 */
export function LevelFinder() {
  const [age, setAge] = useState<number>(7);
  const reducedMotion = useReducedMotion();
  const t = useTranslations("levelFinder");
  const def = useMemo(() => defForAge(age), [age]);

  const name = t(`levels.${def.key}.name`);
  const ages = t(`levels.${def.key}.ages`);
  const ball = t(`levels.${def.key}.ball`);
  const pitch = t(`levels.${def.key}.pitch`);
  const hooks = t.raw(`levels.${def.key}.hooks`) as string[];

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-md)]">
      {/* Header strip */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] bg-[var(--grass)] px-5 py-3 text-white sm:px-8">
        <span className="inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider">
          <Target aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          ITF · Play + Stay
        </span>
        <span className="text-[12px] font-bold text-white/85">
          {t("kicker")}
        </span>
      </header>

      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        {/* ─── LEFT · age picker ─── */}
        <div className="p-6 sm:p-10">
          <h3 className="headline text-[clamp(1.7rem,4vw,2.4rem)] text-[var(--forest)]">
            {t("title")}
          </h3>
          <p className="mt-3 text-[14.5px] leading-[1.65] text-[var(--forest-soft)]">
            {t("description")}
          </p>

          <fieldset className="mt-8">
            <legend className="mb-4 inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
              {t("legend")} —
              <span className="rounded-full bg-[var(--sun)] px-2.5 py-0.5 text-[12.5px] text-[var(--forest)]">
                {age}
              </span>
            </legend>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {AGE_RANGE.map((a) => {
                const d = defForAge(a);
                const lvlName = t(`levels.${d.key}.name`);
                const active = a === age;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAge(a)}
                    aria-pressed={active}
                    aria-label={t("ageAriaLabel", { age: a, level: lvlName })}
                    className="relative aspect-square overflow-hidden rounded-xl font-display text-[16px] font-extrabold transition-all sm:text-[18px]"
                    style={{
                      border: `2px solid ${active ? d.color : "var(--rule)"}`,
                      background: active ? d.color : "var(--cream-soft)",
                      color: active ? "white" : "var(--forest)",
                      transform: active ? "translateY(-2px)" : undefined,
                      boxShadow: active
                        ? `0 5px 0 ${d.colorDeep}`
                        : "0 1px 0 var(--rule-soft)",
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-[12.5px] leading-snug text-[var(--forest-mute)]">
              {t("olderHint")}
            </p>
          </fieldset>

          <ul className="mt-8 flex flex-wrap gap-2">
            {LEVEL_DEFS.map((l) => {
              const isCurrent = l.key === def.key;
              const lvlName = t(`levels.${l.key}.name`);
              return (
                <li key={l.key}>
                  <button
                    type="button"
                    onClick={() => setAge(l.range[0])}
                    className="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors"
                    style={{
                      borderColor: isCurrent ? l.color : "var(--rule)",
                      background: isCurrent ? l.tint : "var(--cream-soft)",
                      color: isCurrent ? l.colorDeep : "var(--forest-mute)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                    {lvlName}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ─── RIGHT · level result card ─── */}
        <div
          className="relative flex flex-col justify-between border-t border-[var(--rule)] p-6 sm:p-10 lg:border-l lg:border-t-0"
          style={{
            background: `linear-gradient(140deg, ${def.tint} 0%, var(--cream-soft) 80%)`,
          }}
        >
          {/* Decorative oversized brand ball */}
          <BallMark className="pointer-events-none absolute right-6 top-6 h-28 w-28 opacity-25 sm:right-10 sm:top-10 sm:h-44 sm:w-44" />

          <AnimatePresence mode="wait">
            <motion.article
              key={def.key}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-full flex-col gap-5"
            >
              <div>
                <span className="inline-flex rounded-full bg-[var(--cream-soft)] border border-[var(--rule)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest)]">
                  {t("forAge", { age })}
                </span>
                <h4
                  className="mt-3 headline text-[clamp(2.4rem,7vw,4rem)] leading-none"
                  style={{ color: def.color }}
                >
                  {t("levelLabel", { name })}
                </h4>
                <p className="mt-2 font-script text-[24px]" style={{ color: def.colorDeep }}>
                  {ages}
                </p>
              </div>

              <p className="max-w-prose text-[15px] leading-[1.7] text-[var(--forest)]">
                {pitch}
              </p>

              <ul className="grid gap-2">
                {hooks.map((hook) => (
                  <li
                    key={hook}
                    className="flex items-center gap-3 rounded-xl bg-[var(--cream-soft)] border border-[var(--rule)] px-3 py-2 text-[13.5px] font-bold text-[var(--forest)]"
                  >
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"
                      style={{ background: def.color }}
                      aria-hidden
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {hook}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)]/15 pt-4">
                <span
                  className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider"
                  style={{ color: def.colorDeep }}
                >
                  <BallMark className="h-4 w-4" />
                  {t("ballLabel", { ball })}
                </span>
                <a
                  href={CONTACT.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--rule)] px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-transform hover:-translate-y-0.5"
                  style={{
                    background: def.color,
                    boxShadow: `0 5px 0 var(--forest)`,
                  }}
                >
                  {t("ctaReserve")} <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                </a>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
