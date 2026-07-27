"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CategoryPicker, type CategoryPickerHandle } from "./category-picker";
import type { Category } from "@/lib/types";

/** Read-bar column control: rename catalog + confirmed move. */
export function ReadCategoryControl({
  articleSlug,
  categories: initialCategories,
  categorySlug: initialSlug,
  articleCounts = {},
}: {
  articleSlug: string;
  categories: Category[];
  categorySlug: string | null;
  articleCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const pickerRef = useRef<CategoryPickerHandle>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [categorySlug, setCategorySlug] = useState(initialSlug);
  const [counts, setCounts] = useState(articleCounts);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    setCategorySlug(initialSlug);
  }, [initialSlug]);

  useEffect(() => {
    setCounts(articleCounts);
  }, [articleCounts]);

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
      articleCounts={counts}
      onChange={(next) => {
        void persistCategory(next);
      }}
      onCategoriesChange={(next) => {
        setCategories(next);
        setCounts((current) => {
          const pruned: Record<string, number> = {};
          for (const category of next) {
            pruned[category.slug] = current[category.slug] ?? 0;
          }
          return pruned;
        });
        startTransition(() => {
          router.refresh();
        });
      }}
    />
  );
}
