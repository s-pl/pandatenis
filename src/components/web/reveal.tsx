"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
};

export function Reveal({ children, className, delay = 0, y = 22, once = true, ...props }: RevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("will-change-transform", className)}
      initial={reducedMotion ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount: 0.2, margin: "0px 0px -90px 0px" }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
