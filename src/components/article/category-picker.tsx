"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Category } from "@/lib/types";

type Props = {
  categories: Category[];
  value: string | null;
  onChange: (categorySlug: string | null) => void;
  onCategoriesChange: (categories: Category[]) => void;
};

/**
 * Underlined combobox: type to create/rename, hover to pick a column.
 * Article assignment is parent-controlled (Release-only).
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  onCategoriesChange,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => nameForSlug(categories, value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(nameForSlug(categories, value));
  }, [categories, value]);

  async function commit() {
    const trimmed = text.trim();
    setError(null);

    if (!trimmed) {
      onChange(null);
      setText("");
      return;
    }

    const matched = categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (matched) {
      onChange(matched.slug);
      setText(matched.name);
      return;
    }

    setBusy(true);
    try {
      if (value) {
        const res = await fetch(`/api/categories/${value}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = (await res.json().catch(() => null)) as
          | (Category & { error?: undefined })
          | { error?: string }
          | null;
        if (!res.ok || !data || typeof (data as Category).slug !== "string") {
          setError(
            (data && "error" in data && data.error) || "Failed to rename",
          );
          setText(nameForSlug(categories, value));
          return;
        }
        const renamed = data as Category;
        onCategoriesChange(
          categories.map((c) => (c.slug === value ? renamed : c)),
        );
        onChange(renamed.slug);
        setText(renamed.name);
        return;
      }

      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as
        | (Category & { error?: undefined })
        | { error?: string }
        | null;
      if (!res.ok || !data || typeof (data as Category).slug !== "string") {
        setError(
          (data && "error" in data && data.error) || "Failed to create",
        );
        return;
      }
      const created = data as Category;
      const exists = categories.some((c) => c.slug === created.slug);
      onCategoriesChange(exists ? categories : [...categories, created]);
      onChange(created.slug);
      setText(created.name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`category-picker${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <input
        className="category-picker-input"
        value={text}
        disabled={busy}
        placeholder="Column"
        aria-label="Article column"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so list item clicks can fire first.
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              void commit();
            }
          }, 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
            setOpen(false);
            (event.target as HTMLInputElement).blur();
          }
          if (event.key === "Escape") {
            setText(nameForSlug(categories, value));
            setOpen(false);
            (event.target as HTMLInputElement).blur();
          }
        }}
      />

      {open && categories.length > 0 ? (
        <ul id={listId} className="category-picker-list" role="listbox">
          <li>
            <button
              type="button"
              role="option"
              className={`category-picker-option${!value ? " is-active" : ""}`}
              aria-selected={!value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(null);
                setText("");
                setOpen(false);
              }}
            >
              No column
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.slug}>
              <button
                type="button"
                role="option"
                className={`category-picker-option${
                  value === category.slug ? " is-active" : ""
                }`}
                aria-selected={value === category.slug}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(category.slug);
                  setText(category.name);
                  setOpen(false);
                }}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="category-picker-error">{error}</p> : null}
    </div>
  );
}

function nameForSlug(categories: Category[], slug: string | null) {
  if (!slug) return "";
  return categories.find((c) => c.slug === slug)?.name ?? "";
}
