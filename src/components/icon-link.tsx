import Link from "next/link";
import type { ReactNode } from "react";

export function IconLink({
  href,
  label,
  children,
  prefetch = true,
}: {
  href: string;
  label: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={label}
      title={label}
      className="icon-btn icon-btn-motion"
    >
      {children}
    </Link>
  );
}
