"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { CheckIcon, XIcon } from "../chrome/icons";
import { DeleteControl } from "../chrome/delete-control";
import type { Category } from "@/lib/types";

type Props = {
  categories: Category[];
  value: string | null;
  onChange: (categorySlug: string | null) => void;
  onCategoriesChange: (categories: Category[]) => void;
  /** Article counts per category slug — empty columns show a delete control. */
  articleCounts?: Record<string, number>;
};

export type CategoryPickerHandle = {
  /** Resolve typed/selected column before Save — avoids blur race. */
  flush: () => Promise<string | null>;
};

/**
 * Underlined combobox: type to create/rename, hover to pick a column.
 * Picking another column arms a delete-style confirm (X + ✓) before onChange.
 */
export const CategoryPicker = forwardRef<CategoryPickerHandle, Props>(
  function CategoryPicker(
    {
      categories,
      value,
      onChange,
      onCategoriesChange,
      articleCounts = {},
    },
    ref,
  ) {
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const textRef = useRef(nameForSlug(categories, value));
    const valueRef = useRef(value);
    const categoriesRef = useRef(categories);
    const pendingRef = useRef<string | null | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(() => nameForSlug(categories, value));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** `undefined` = no pending switch; `null` = pending Loose. */
    const [pending, setPending] = useState<string | null | undefined>(
      undefined,
    );

    useEffect(() => {
      const next = nameForSlug(categories, value);
      setText(next);
      textRef.current = next;
      setPending(undefined);
      pendingRef.current = undefined;
    }, [categories, value]);

    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    useEffect(() => {
      categoriesRef.current = categories;
    }, [categories]);

    useEffect(() => {
      pendingRef.current = pending;
    }, [pending]);

    function cancelPending() {
      setPending(undefined);
      pendingRef.current = undefined;
      const fallback = nameForSlug(categoriesRef.current, valueRef.current);
      setText(fallback);
      textRef.current = fallback;
    }

    function applyPending() {
      if (pendingRef.current === undefined) return valueRef.current;
      const next = pendingRef.current;
      setPending(undefined);
      pendingRef.current = undefined;
      onChange(next);
      const label = nameForSlug(categoriesRef.current, next);
      setText(label);
      textRef.current = label;
      return next;
    }

    function requestSelect(next: string | null) {
      if (next === valueRef.current) {
        setOpen(false);
        setPending(undefined);
        pendingRef.current = undefined;
        const label = nameForSlug(categoriesRef.current, next);
        setText(label);
        textRef.current = label;
        return;
      }
      setPending(next);
      pendingRef.current = next;
      const label = nameForSlug(categoriesRef.current, next);
      setText(label);
      textRef.current = label;
      setOpen(false);
    }

    async function deleteEmptyCategory(slug: string) {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/categories/${slug}`, { method: "DELETE" });
        const data = (await res.json().catch(() => null)) as
          | { categories?: Category[]; error?: string }
          | null;
        if (!res.ok) {
          setError(data?.error || "Failed to delete column");
          return;
        }
        const next =
          data && Array.isArray(data.categories)
            ? data.categories
            : categoriesRef.current.filter((c) => c.slug !== slug);
        onCategoriesChange(next);
        if (valueRef.current === slug) {
          onChange(null);
          setText("");
          textRef.current = "";
        }
        if (pendingRef.current === slug) {
          setPending(undefined);
          pendingRef.current = undefined;
        }
      } finally {
        setBusy(false);
      }
    }

    async function commit(rawText = textRef.current): Promise<string | null> {
      if (pendingRef.current !== undefined) {
        return applyPending();
      }

      const trimmed = rawText.trim();
      const currentValue = valueRef.current;
      const currentCategories = categoriesRef.current;
      setError(null);

      if (!trimmed) {
        if (currentValue !== null) {
          requestSelect(null);
          return currentValue;
        }
        onChange(null);
        setText("");
        textRef.current = "";
        return null;
      }

      const matched = currentCategories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (matched) {
        if (matched.slug !== currentValue) {
          requestSelect(matched.slug);
          return currentValue;
        }
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

    const switching = pending !== undefined;

    return (
      <div
        ref={rootRef}
        className={`category-picker${open ? " is-open" : ""}${
          switching ? " is-switching" : ""
        }`}
        onMouseEnter={() => {
          if (!switching) setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="category-picker-field">
          <input
            className="category-picker-input"
            value={text}
            disabled={busy}
            placeholder="Column"
            role="combobox"
            aria-label="Article column"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            onChange={(event) => {
              // Typing outranks an armed switch — otherwise emptying the field
              // arms Loose and leaves nothing that accepts input.
              if (pendingRef.current !== undefined) {
                setPending(undefined);
                pendingRef.current = undefined;
              }
              setText(event.target.value);
              textRef.current = event.target.value;
            }}
            onFocus={() => {
              if (!switching) setOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                if (!rootRef.current?.contains(document.activeElement)) {
                  if (pendingRef.current !== undefined) return;
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
                if (pendingRef.current !== undefined) {
                  cancelPending();
                  return;
                }
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

          {switching ? (
            <div
              className="delete-control is-armed category-switch-confirm"
              role="group"
              aria-label="Confirm column change"
            >
              <div className="delete-control-extend">
                <div className="delete-control-extend-inner">
                  <button
                    type="button"
                    className="delete-control-confirm-btn"
                    aria-label="Confirm column change"
                    title="Confirm"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      applyPending();
                    }}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="delete-control-trigger-compact delete-control-trigger"
                aria-label="Cancel column change"
                title="Cancel"
                onMouseDown={(event) => event.preventDefault()}
                onClick={cancelPending}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {open && !switching && categories.length > 0 ? (
          <ul id={listId} className="category-picker-list" role="listbox">
            {categories.map((category) => {
              const count = articleCounts[category.slug] ?? 0;
              return (
                <li key={category.slug} className="category-picker-row">
                  <button
                    type="button"
                    role="option"
                    className={`category-picker-option${
                      value === category.slug ? " is-active" : ""
                    }`}
                    aria-selected={value === category.slug}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      requestSelect(category.slug);
                    }}
                  >
                    <span className="category-picker-option-label">
                      {category.name}
                    </span>
                    {count > 0 ? (
                      <span className="category-picker-option-count">
                        {count}
                      </span>
                    ) : null}
                  </button>
                  {count === 0 ? (
                    <DeleteControl
                      compact
                      busy={busy}
                      onConfirm={() => {
                        void deleteEmptyCategory(category.slug);
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
            <li className="category-picker-row">
              <button
                type="button"
                role="option"
                className={`category-picker-option is-loose${!value ? " is-active" : ""}`}
                aria-selected={!value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  requestSelect(null);
                }}
              >
                <span className="category-picker-option-label">Loose</span>
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
