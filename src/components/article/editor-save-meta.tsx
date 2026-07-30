"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  stamp: string | null;
  /**
   * Changes when a save completes. On phones, the stamp briefly expands into
   * the title slot, then eases away so Column/Title keep their room.
   */
  pulseKey?: number | null;
};

const MOBILE_FLASH_MS = 1600;

/** Fixed-width stamp on desktop; mobile flashes after each save. */
export function EditorSaveMeta({ stamp, pulseKey = null }: Props) {
  const [display, setDisplay] = useState(stamp);
  const [visible, setVisible] = useState(Boolean(stamp));
  const [flashing, setFlashing] = useState(false);
  const [compactViewport, setCompactViewport] = useState(false);
  const prevPulseRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setCompactViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  useEffect(() => {
    if (pulseKey == null) return;

    // First paint with an existing article — don't steal title room.
    if (prevPulseRef.current === undefined) {
      prevPulseRef.current = pulseKey;
      return;
    }
    if (prevPulseRef.current === pulseKey) return;
    prevPulseRef.current = pulseKey;

    if (!compactViewport) return;

    setFlashing(true);
    const timer = window.setTimeout(() => setFlashing(false), MOBILE_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [pulseKey, compactViewport]);

  return (
    <span
      className={[
        "editor-save-meta",
        visible ? "is-visible" : "",
        flashing ? "is-flashing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={display ? `Last saved · ${display}` : "Last saved"}
      aria-live="polite"
    >
      {display ?? ""}
    </span>
  );
}
