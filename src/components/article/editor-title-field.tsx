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
  const [compactViewport, setCompactViewport] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Only the label tap parks the caret at the end. */
  const fromLabelRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setCompactViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    // Tapped or dragged straight into the input — leave that caret alone.
    if (document.activeElement === el) return;
    el.focus();
    if (fromLabelRef.current) {
      fromLabelRef.current = false;
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  const collapsedMobile = compactViewport && !editing;
  const label = value || placeholder;

  return (
    <div
      ref={wrapRef}
      className={`editor-title-field${editing ? " is-editing" : ""}`}
    >
      <button
        type="button"
        className={`editor-title-compact${value ? "" : " is-placeholder"}`}
        tabIndex={collapsedMobile ? 0 : -1}
        aria-hidden={collapsedMobile ? undefined : true}
        aria-label={value ? undefined : ariaLabel}
        title={label}
        onClick={() => {
          fromLabelRef.current = true;
          setEditing(true);
        }}
      >
        <span className="editor-title-compact-text">{label}</span>
      </button>
      <input
        ref={inputRef}
        className="editor-title"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-hidden={collapsedMobile ? true : undefined}
        tabIndex={collapsedMobile ? -1 : undefined}
        enterKeyHint="done"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          // Selection handles and keyboard churn can fire a transient blur.
          window.setTimeout(() => {
            if (wrapRef.current?.contains(document.activeElement)) return;
            setEditing(false);
          }, 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
