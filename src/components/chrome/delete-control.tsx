"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, TrashIcon, XIcon } from "./icons";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
};

/**
 * Trash → click → becomes X while a confirm strip extends with ✓.
 * Only an explicit click dismisses (outside / X / confirm). Mouse leave does not.
 */
export function DeleteControl({ disabled, busy, onConfirm }: Props) {
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

  return (
    <div
      ref={rootRef}
      className={`delete-control${armed ? " is-armed" : ""}`}
    >
      <button
        type="button"
        className="icon-btn icon-btn-motion delete-control-trigger"
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
          <XIcon className="h-5 w-5" />
        ) : (
          <TrashIcon className="h-5 w-5" />
        )}
      </button>

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
            <CheckIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
