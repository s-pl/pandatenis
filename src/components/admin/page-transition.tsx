"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { springSnappy } from "@/components/ui/motion";

/**
 * Transición de entrada al cambiar de ruta. La `key` por pathname remonta el
 * subtree, así que la animación se vuelve a ejecutar en cada navegación.
 * Respeta `prefers-reduced-motion`.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <div key={pathname}>{children}</div>;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springSnappy}
      style={{ transformOrigin: "top center" }}
    >
      {children}
    </motion.div>
  );
}
