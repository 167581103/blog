"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Keep first paint visible (never opacity:0 on SSR) so the page never looks blank. */
export function PageFade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
