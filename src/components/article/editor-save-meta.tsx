"use client";

import { useEffect, useState } from "react";

type Props = {
  stamp: string | null;
};

const FADE_MS = 160;

/** Fixed-width stamp so title centering stays stable; fades on text change. */
export function EditorSaveMeta({ stamp }: Props) {
  const [display, setDisplay] = useState(stamp);
  const [target, setTarget] = useState(stamp);

  if (stamp !== target) setTarget(stamp);

  // Text swaps only after the old one has faded out.
  const fading = target !== display;
  const visible = Boolean(display) && !fading;

  useEffect(() => {
    if (!fading) return;
    const timer = window.setTimeout(() => setDisplay(target), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [fading, target]);

  return (
    <span
      className={`editor-save-meta${visible ? " is-visible" : ""}`}
      title={display ? `Last saved · ${display}` : "Last saved"}
      aria-live="polite"
    >
      {display ?? ""}
    </span>
  );
}
