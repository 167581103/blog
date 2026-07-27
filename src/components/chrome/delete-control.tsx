"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, TrashIcon, XIcon } from "./icons";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  /** Compact trigger for dense menus (category picker rows). */
  compact?: boolean;
  onConfirm: () => void;
};

/**
 * Trash → click → X stays where the trash was; ✓ extends beside it.
 * (In right-aligned bars the strip grows left so X does not slide.)
 * Only an explicit click dismisses (outside / X / confirm). Mouse leave does not.
 */
export function DeleteControl({
  disabled,
  busy,
  compact,
  onConfirm,
}: Props) {
  const [armed, setArmed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const confirmId = useId();

  useEffect(() => {
    if (!armed) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setArmed(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setArmed(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [armed]);

  useEffect(() => {
    if (disabled || busy) setArmed(false);
  }, [disabled, busy]);

  const iconClass = compact ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div
      ref={rootRef}
      className={[
        "delete-control",
        armed && "is-armed",
        compact && "is-compact",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        id={confirmId}
        className="delete-control-extend"
        role="group"
        aria-label="Confirm delete"
        aria-hidden={!armed}
      >
        <div className="delete-control-extend-inner">
          <button
            type="button"
            className="delete-control-confirm-btn"
            aria-label="Confirm delete"
            title="Confirm delete"
            tabIndex={armed ? 0 : -1}
            disabled={busy || !armed}
            onClick={() => {
              setArmed(false);
              onConfirm();
            }}
          >
            <CheckIcon className={iconClass} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className={[
          compact ? "delete-control-trigger-compact" : "icon-btn icon-btn-motion",
          "delete-control-trigger",
        ].join(" ")}
        aria-label={armed ? "Cancel delete" : "Delete"}
        title={armed ? "Cancel delete" : "Delete"}
        aria-expanded={armed}
        aria-controls={confirmId}
        disabled={disabled || busy}
        onClick={() => {
          if (disabled || busy) return;
          setArmed((value) => !value);
        }}
      >
        {armed ? (
          <XIcon className={iconClass} />
        ) : (
          <TrashIcon className={iconClass} />
        )}
      </button>
    </div>
  );
}
