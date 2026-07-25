import type { ReactNode } from "react";

/** CSS-only entrance — no framer-motion on the public read path. */
export function PageFade({ children }: { children: ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
