import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
};

/** Lightweight button — CSS hover/tap instead of framer-motion. */
export function IconButton({
  children,
  label,
  className,
  disabled,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`icon-btn icon-btn-motion ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
