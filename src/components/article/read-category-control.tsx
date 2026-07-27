"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CategoryPicker, type CategoryPickerHandle } from "./category-picker";
import type { Category } from "@/lib/types";

/** Read-bar column control: rename catalog + move article immediately. */
export function ReadCategoryControl({
  articleSlug,
  categories: initialCategories,
  categorySlug: initialSlug,
}: {
  articleSlug: string;
  categories: Category[];
  categorySlug: string | null;
}) {
  const router = useRouter();
  const pickerRef = useRef<CategoryPickerHandle>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [categorySlug, setCategorySlug] = useState(initialSlug);
  const [, startTransition] = useTransition();

  async function persistCategory(next: string | null) {
    const previous = categorySlug;
    setCategorySlug(next);
    try {
      const res = await fetch(`/api/articles/${articleSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlug: next }),
      });
      if (!res.ok) {
        setCategorySlug(previous);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setCategorySlug(previous);
    }
  }

  return (
    <CategoryPicker
      ref={pickerRef}
      categories={categories}
      value={categorySlug}
      onChange={(next) => {
        void persistCategory(next);
      }}
      onCategoriesChange={setCategories}
    />
  );
}
