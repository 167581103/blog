import { cache } from "react";
import { randomUUID } from "node:crypto";
import type { Category } from "../types";
import { slugify } from "../slug";
import {
  assertBlobConfigured,
  isBlobConfigured,
  putJson,
  readJsonByPath,
} from "./blob";

const INDEX_PATH = "categories/index.json";

async function readIndex(): Promise<Category[]> {
  if (!isBlobConfigured()) return [];
  try {
    const items = await readJsonByPath<Category[]>(INDEX_PATH);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function writeIndex(categories: Category[]) {
  assertBlobConfigured();
  await putJson(INDEX_PATH, categories);
}

export const listCategories = cache(async (): Promise<Category[]> => {
  return readIndex();
});

export async function createCategory(name: string): Promise<Category> {
  assertBlobConfigured();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");

  const categories = await readIndex();
  const existing = categories.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const base = slugify(trimmed);
  let slug = base;
  let i = 2;
  const taken = new Set(categories.map((c) => c.slug));
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
  await writeIndex([...categories, category]);
  return category;
}

export async function renameCategory(
  slug: string,
  name: string,
): Promise<Category | null> {
  assertBlobConfigured();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");

  const categories = await readIndex();
  const index = categories.findIndex((c) => c.slug === slug);
  if (index < 0) return null;

  const conflict = categories.find(
    (c) =>
      c.slug !== slug && c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (conflict) {
    throw new Error("A category with that name already exists");
  }

  const now = new Date().toISOString();
  const next = categories.map((c, i) =>
    i === index ? { ...c, name: trimmed, updatedAt: now } : c,
  );
  await writeIndex(next);
  return next[index]!;
}

/** Persist homepage / picker order. `slugs` must be a permutation of existing categories. */
export async function reorderCategories(slugs: string[]): Promise<Category[]> {
  assertBlobConfigured();
  const categories = await readIndex();
  if (slugs.length !== categories.length) {
    throw new Error("Category order must include every column");
  }

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const next: Category[] = [];
  for (const slug of slugs) {
    const category = bySlug.get(slug);
    if (!category) throw new Error(`Unknown category: ${slug}`);
    if (next.some((c) => c.slug === slug)) {
      throw new Error("Duplicate category in order");
    }
    next.push(category);
  }

  await writeIndex(next);
  return next;
}
