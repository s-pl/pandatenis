"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Transition,
  type Variants,
} from "framer-motion";
import type { ReactNode } from "react";

/**
 * Utilidades de animación expresivas y reutilizables para el panel.
 *
 * Todas respetan `prefers-reduced-motion`: si el usuario lo pide, los
 * componentes renderizan un `<div>` plano sin animación.
 */

// Springs con algo de rebote (personalidad "expresiva").
export const springSnappy: Transition = { type: "spring", stiffness: 460, damping: 30, mass: 0.7 };
export const springBouncy: Transition = { type: "spring", stiffness: 520, damping: 20, mass: 0.8 };
export const springSoft: Transition = { type: "spring", stiffness: 300, damping: 26 };

/** Entrada estándar: aparece subiendo con un punch de escala. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: springSnappy },
};

/** Contenedor que escalona la entrada de sus hijos (usar con StaggerItem). */
export function staggerContainer(stagger = 0.06, delayChildren = 0.04): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  /** Retraso adicional antes de animar (s). */
  delay?: number;
};

/** Revela un bloque con entrada expresiva. Ideal para envolver tarjetas/secciones. */
export function Reveal({ children, className, delay = 0, ...props }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={fadeUp}
      transition={{ ...springSnappy, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  stagger?: number;
  delayChildren?: number;
};

/** Contenedor de stagger: sus <StaggerItem> entran en cascada. */
export function Stagger({ children, className, stagger, delayChildren, ...props }: StaggerProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={staggerContainer(stagger, delayChildren)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Hijo de <Stagger>. Hereda el timing del contenedor. */
export function StaggerItem({ children, className, ...props }: HTMLMotionProps<"div"> & { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={fadeUp} {...props}>
      {children}
    </motion.div>
  );
}
