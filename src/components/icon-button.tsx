"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function IconButton({
  children,
  label,
  className,
  disabled,
  onClick,
}: Props) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.06 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`icon-btn ${className ?? ""}`}
    >
      {children}
    </motion.button>
  );
}
