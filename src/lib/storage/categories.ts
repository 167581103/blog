import { cache } from "react";
import { randomUUID } from "node:crypto";
import {
  flattenCategoryRows,
  normalizeCategoryRows,
  soloRowsForCategories,
  type CategoryLayout,
} from "../category-layout";
import type { Category } from "../types";
import { slugify } from "../slug";
import {
  assertBlobConfigured,
  isBlobConfigured,
  putJson,
  readJsonByPath,
} from "./blob";

const INDEX_PATH = "categories/index.json";

type CategoriesDoc = {
  categories: Category[];
  rows: string[][];
};

type StoredCategories = Category[] | CategoriesDoc;

function isDoc(value: StoredCategories): value is CategoriesDoc {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Array.isArray((value as CategoriesDoc).categories),
  );
}

function toLayout(raw: StoredCategories | null): CategoryLayout {
  if (!raw) return { categories: [], rows: [] };

  if (Array.isArray(raw)) {
    const categories = raw.filter(Boolean);
    return {
      categories,
      rows: soloRowsForCategories(categories),
    };
  }

  if (!isDoc(raw)) return { categories: [], rows: [] };

  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  const slugs = categories.map((c) => c.slug);
  const rows = normalizeCategoryRows(
    Array.isArray(raw.rows) ? raw.rows : soloRowsForCategories(categories),
    slugs,
  );
  // Keep category array in row-major order for pickers / defaults.
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const ordered = flattenCategoryRows(rows)
    .map((slug) => bySlug.get(slug))
    .filter((c): c is Category => Boolean(c));
  return { categories: ordered, rows };
}

async function readDoc(): Promise<CategoryLayout> {
  if (!isBlobConfigured()) return { categories: [], rows: [] };
  try {
    const raw = await readJsonByPath<StoredCategories>(INDEX_PATH);
    return toLayout(raw);
  } catch {
    return { categories: [], rows: [] };
  }
}

async function writeDoc(layout: CategoryLayout) {
  assertBlobConfigured();
  const slugs = layout.categories.map((c) => c.slug);
  const rows = normalizeCategoryRows(layout.rows, slugs);
  const bySlug = new Map(layout.categories.map((c) => [c.slug, c]));
  const categories = flattenCategoryRows(rows)
    .map((slug) => bySlug.get(slug))
    .filter((c): c is Category => Boolean(c));
  const doc: CategoriesDoc = { categories, rows };
  await putJson(INDEX_PATH, doc);
  return { categories, rows };
}

export const listCategoryLayout = cache(
  async (): Promise<CategoryLayout> => readDoc(),
);

/** Categories in homepage row-major order (picker matches homepage). */
export const listCategories = cache(async (): Promise<Category[]> => {
  const layout = await readDoc();
  return layout.categories;
});

export async function createCategory(name: string): Promise<Category> {
  assertBlobConfigured();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");

  const layout = await readDoc();
  const existing = layout.categories.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const base = slugify(trimmed);
  let slug = base;
  let i = 2;
  const taken = new Set(layout.categories.map((c) => c.slug));
  while (taken.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }

  const category: Category = {
    id: randomUUID(),
    slug,
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  };
  // New columns start as their own full-width row.
  await writeDoc({
    categories: [...layout.categories, category],
    rows: [...layout.rows, [slug]],
  });
  return category;
}

export async function renameCategory(
  slug: string,
  name: string,
): Promise<Category | null> {
  assertBlobConfigured();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");

  const layout = await readDoc();
  const index = layout.categories.findIndex((c) => c.slug === slug);
  if (index < 0) return null;

  const conflict = layout.categories.find(
    (c) =>
      c.slug !== slug && c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (conflict) {
    throw new Error("A category with that name already exists");
  }

  const now = new Date().toISOString();
  const categories = layout.categories.map((c, i) =>
    i === index ? { ...c, name: trimmed, updatedAt: now } : c,
  );
  const next = await writeDoc({ categories, rows: layout.rows });
  return next.categories.find((c) => c.slug === slug) ?? null;
}

/** Persist homepage row layout. `rows` must cover every category slug. */
export async function setCategoryRows(
  rows: string[][],
): Promise<CategoryLayout> {
  assertBlobConfigured();
  const layout = await readDoc();
  const slugs = layout.categories.map((c) => c.slug);
  const normalized = normalizeCategoryRows(rows, slugs);
  const flat = flattenCategoryRows(normalized);
  if (flat.length !== slugs.length) {
    throw new Error("Category rows must include every column");
  }
  return writeDoc({ categories: layout.categories, rows: normalized });
}

/**
 * @deprecated Prefer setCategoryRows. Flat slug order becomes solo rows
 * (one column per row) to preserve stacked layout when migrating callers.
 */
export async function reorderCategories(slugs: string[]): Promise<Category[]> {
  const layout = await setCategoryRows(slugs.map((slug) => [slug]));
  return layout.categories;
}
