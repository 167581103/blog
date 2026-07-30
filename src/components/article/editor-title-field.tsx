"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
};

/**
 * Desktop: always an editable title input.
 * Mobile: compact truncated label → tap expands to input → blur collapses.
 */
export function EditorTitleField({
  value,
  onChange,
  placeholder = "Title",
  "aria-label": ariaLabel = "Title",
}: Props) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [editing]);

  return (
    <div className={`editor-title-field${editing ? " is-editing" : ""}`}>
      <button
        type="button"
        className={`editor-title-compact${value ? "" : " is-placeholder"}`}
        tabIndex={editing ? -1 : 0}
        aria-label={ariaLabel}
        title={value || placeholder}
        onClick={() => setEditing(true)}
      >
        <span className="editor-title-compact-text">
          {value || placeholder}
        </span>
      </button>
      <input
        ref={inputRef}
        className="editor-title"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
      />
    </div>
  );
}
