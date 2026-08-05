"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
};

/**
 * Desktop: always an editable title input.
 * Mobile: compact truncated label → tap expands to input → blur collapses.
 * While expanded, a horizontal scroll rail lets the finger pan a long title;
 * caret fine-tuning stays with the system long-press UI.
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  /** Only the label tap parks the caret at the end. */
  const fromLabelRef = useRef(false);
  const scrollToEndRef = useRef(false);

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
    // Tapped straight into the input — leave that caret alone.
    if (document.activeElement === el) return;
    el.focus();
    if (fromLabelRef.current) {
      fromLabelRef.current = false;
      const len = el.value.length;
      el.setSelectionRange(len, len);
      scrollToEndRef.current = true;
    }
  }, [editing]);

  const swipeScroll = compactViewport && editing;

  // Size the input to the full string so the rail — not the input's internal
  // field — is what overflows and accepts a finger pan.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const scroll = scrollRef.current;
    const measure = measureRef.current;
    if (!input) return;

    if (!swipeScroll || !scroll || !measure) {
      input.style.width = "";
      return;
    }

    const syncWidth = () => {
      const rail = scroll.clientWidth;
      const needed = Math.ceil(measure.scrollWidth + 32);
      input.style.width = `${Math.max(rail, needed)}px`;
      if (scrollToEndRef.current) {
        scrollToEndRef.current = false;
        scroll.scrollLeft = scroll.scrollWidth;
      }
    };

    syncWidth();
    const ro = new ResizeObserver(syncWidth);
    ro.observe(scroll);
    return () => {
      ro.disconnect();
      input.style.width = "";
    };
  }, [swipeScroll, value, placeholder]);

  // iOS often spends horizontal drags on caret scrubbing inside <input>.
  // After a small threshold, take the gesture as a rail pan; below it, leave
  // the touch alone so long-press / tap caret placement still work.
  useEffect(() => {
    if (!swipeScroll) return;
    const rail = scrollRef.current;
    if (!rail) return;

    let startX = 0;
    let startScroll = 0;
    let panning = false;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startScroll = rail.scrollLeft;
      panning = false;
    };

    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - startX;
      if (!panning && Math.abs(dx) < 10) return;
      panning = true;
      rail.scrollLeft = startScroll - dx;
      event.preventDefault();
    };

    rail.addEventListener("touchstart", onStart, { passive: true });
    rail.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      rail.removeEventListener("touchstart", onStart);
      rail.removeEventListener("touchmove", onMove);
    };
  }, [swipeScroll]);

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
      <div ref={scrollRef} className="editor-title-scroll">
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
        {swipeScroll ? (
          <span
            ref={measureRef}
            className="editor-title-measure"
            aria-hidden="true"
          >
            {value || placeholder}
          </span>
        ) : null}
      </div>
    </div>
  );
}
