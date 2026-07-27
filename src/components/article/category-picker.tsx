"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Category } from "@/lib/types";

type Props = {
  categories: Category[];
  value: string | null;
  onChange: (categorySlug: string | null) => void;
  onCategoriesChange: (categories: Category[]) => void;
};

export type CategoryPickerHandle = {
  /** Resolve typed/selected column before Save — avoids blur race. */
  flush: () => Promise<string | null>;
};

/**
 * Underlined combobox: type to create/rename, hover to pick a column.
 * Article assignment is parent-controlled (Release-only / create stamp).
 */
export const CategoryPicker = forwardRef<CategoryPickerHandle, Props>(
  function CategoryPicker(
    { categories, value, onChange, onCategoriesChange },
    ref,
  ) {
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const textRef = useRef(nameForSlug(categories, value));
    const valueRef = useRef(value);
    const categoriesRef = useRef(categories);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(() => nameForSlug(categories, value));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const next = nameForSlug(categories, value);
      setText(next);
      textRef.current = next;
    }, [categories, value]);

    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    useEffect(() => {
      categoriesRef.current = categories;
    }, [categories]);

    async function commit(rawText = textRef.current): Promise<string | null> {
      const trimmed = rawText.trim();
      const currentValue = valueRef.current;
      const currentCategories = categoriesRef.current;
      setError(null);

      if (!trimmed) {
        onChange(null);
        setText("");
        textRef.current = "";
        return null;
      }

      const matched = currentCategories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (matched) {
        onChange(matched.slug);
        setText(matched.name);
        textRef.current = matched.name;
        return matched.slug;
      }

      setBusy(true);
      try {
        if (currentValue) {
          const res = await fetch(`/api/categories/${currentValue}`, {
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
            const fallback = nameForSlug(currentCategories, currentValue);
            setText(fallback);
            textRef.current = fallback;
            return currentValue;
          }
          const renamed = data as Category;
          onCategoriesChange(
            currentCategories.map((c) =>
              c.slug === currentValue ? renamed : c,
            ),
          );
          onChange(renamed.slug);
          setText(renamed.name);
          textRef.current = renamed.name;
          return renamed.slug;
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
          return currentValue;
        }
        const created = data as Category;
        const exists = currentCategories.some((c) => c.slug === created.slug);
        onCategoriesChange(
          exists ? currentCategories : [...currentCategories, created],
        );
        onChange(created.slug);
        setText(created.name);
        textRef.current = created.name;
        return created.slug;
      } finally {
        setBusy(false);
      }
    }

    useImperativeHandle(ref, () => ({
      flush: () => commit(textRef.current),
    }));

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
          onChange={(event) => {
            setText(event.target.value);
            textRef.current = event.target.value;
          }}
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
              const fallback = nameForSlug(
                categoriesRef.current,
                valueRef.current,
              );
              setText(fallback);
              textRef.current = fallback;
              setOpen(false);
              (event.target as HTMLInputElement).blur();
            }
          }}
        />

        {open && categories.length > 0 ? (
          <ul id={listId} className="category-picker-list" role="listbox">
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
                    textRef.current = category.name;
                    setOpen(false);
                  }}
                >
                  {category.name}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                role="option"
                className={`category-picker-option is-loose${!value ? " is-active" : ""}`}
                aria-selected={!value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(null);
                  setText("");
                  textRef.current = "";
                  setOpen(false);
                }}
              >
                Loose
              </button>
            </li>
          </ul>
        ) : null}

        {error ? <p className="category-picker-error">{error}</p> : null}
      </div>
    );
  },
);

function nameForSlug(categories: Category[], slug: string | null) {
  if (!slug) return "";
  return categories.find((c) => c.slug === slug)?.name ?? "";
}
