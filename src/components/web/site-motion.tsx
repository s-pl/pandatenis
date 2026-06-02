"use client";

import { useEffect } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePathname } from "next/navigation";

gsap.registerPlugin(ScrollTrigger);

export function WebMotionLayer() {
  const pathname = usePathname();

  return (
    <>
      <ScrollProgress />
      <GsapRuntime pathname={pathname} />
    </>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.2,
  });

  return (
    <motion.div
      className="fixed left-0 top-0 z-[70] h-[3px] w-full origin-left bg-[linear-gradient(90deg,var(--grass),var(--sun))]"
      style={{ scaleX }}
      aria-hidden
    />
  );
}

function GsapRuntime({ pathname }: { pathname: string }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const ctx = gsap.context(() => {
      const heroes = gsap.utils.toArray<HTMLElement>("[data-gsap-hero]");

      heroes.forEach((hero) => {
        const image = hero.querySelector<HTMLElement>("[data-gsap-bg]");
        const copy = hero.querySelector<HTMLElement>("[data-gsap-copy]");
        const copyItems = copy ? Array.from(copy.children) : [];
        const stats = gsap.utils.toArray<HTMLElement>(hero.querySelectorAll("[data-gsap-stat]"));
        const floating = gsap.utils.toArray<HTMLElement>(hero.querySelectorAll("[data-gsap-float]"));

        if (copyItems.length > 0) {
          gsap.from(copyItems, {
            autoAlpha: 0,
            y: 26,
            filter: "blur(6px)",
            duration: 0.95,
            ease: "power3.out",
            stagger: 0.08,
            delay: 0.1,
          });
        }

        if (stats.length > 0) {
          gsap.from(stats, {
            autoAlpha: 0,
            y: 20,
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.08,
            delay: 0.4,
          });
        }

        if (image) {
          gsap.to(image, {
            yPercent: 6,
            scale: 1.05,
            ease: "none",
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "bottom top",
              scrub: 0.8,
            },
          });
        }

        if (floating.length > 0) {
          gsap.to(floating, {
            y: -12,
            duration: 5.2,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            stagger: 0.4,
          });
        }
      });

      const cards = gsap.utils.toArray<HTMLElement>("main article, main [data-gsap-card]");
      if (cards.length > 0) {
        gsap.set(cards, { autoAlpha: 0, y: 24 });
        ScrollTrigger.batch(cards, {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.08,
              overwrite: true,
            });
          },
        });
      }

      ScrollTrigger.refresh();
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [pathname, reducedMotion]);

  return null;
}
