"use client";

import { useEffect, useState } from "react";

type Props = {
  stamp: string | null;
};

/** Fixed-width stamp so title centering stays stable; fades on text change. */
export function EditorSaveMeta({ stamp }: Props) {
  const [display, setDisplay] = useState(stamp);
  const [visible, setVisible] = useState(Boolean(stamp));

  useEffect(() => {
    if (stamp === display) {
      setVisible(Boolean(stamp));
      return;
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setDisplay(stamp);
      setVisible(Boolean(stamp));
    }, 160);

    return () => window.clearTimeout(timer);
  }, [stamp, display]);

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
