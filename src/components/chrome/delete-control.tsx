"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "../chrome/icons";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
};

/**
 * Lightweight delete confirm: X stays in place; hover reveals a ✓
 * that must be explicitly targeted to confirm.
 */
export function DeleteControl({ disabled, busy, onConfirm }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`delete-control${open ? " is-open" : ""}`}
      onMouseEnter={() => {
        if (!disabled && !busy) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="icon-btn icon-btn-motion"
        aria-label="Delete"
        title="Delete"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled || busy}
        onClick={() => {
          if (!disabled && !busy) setOpen(true);
        }}
      >
        <XIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div className="delete-confirm" role="menu">
          <button
            type="button"
            className="delete-confirm-check icon-btn"
            role="menuitem"
            aria-label="Confirm delete"
            title="Confirm delete"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            <CheckIcon className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
