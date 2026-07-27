import type { Category } from "./types";

export const MAX_CATEGORIES_PER_ROW = 3;

/** Homepage column layout — rows of 1–3 category slugs. */
export type CategoryLayout = {
  categories: Category[];
  rows: string[][];
};

/**
 * Drop destination, anchored by slug so indices stay stable after removal.
 * - `solo-before`: new full-width row before the row that contains `anchor`
 *   (`anchor === null` → append at end)
 * - `inline-before` / `inline-after`: share a row with `anchor` (max 3)
 */
export type CategoryDropTarget =
  | { mode: "solo-before"; anchor: string | null }
  | { mode: "inline-before"; anchor: string }
  | { mode: "inline-after"; anchor: string };

export function flattenCategoryRows(rows: string[][]): string[] {
  return rows.flat();
}

/** Ensure every slug appears once; drop unknowns; fill missing as solo rows. */
export function normalizeCategoryRows(
  rows: string[][],
  slugs: string[],
): string[][] {
  const allowed = new Set(slugs);
  const seen = new Set<string>();
  const next: string[][] = [];

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cleaned = row.filter((slug) => {
      if (typeof slug !== "string" || !allowed.has(slug) || seen.has(slug)) {
        return false;
      }
      seen.add(slug);
      return true;
    });
    while (cleaned.length > MAX_CATEGORIES_PER_ROW) {
      next.push(cleaned.splice(0, MAX_CATEGORIES_PER_ROW));
    }
    if (cleaned.length) next.push(cleaned);
  }

  for (const slug of slugs) {
    if (!seen.has(slug)) next.push([slug]);
  }

  return next;
}

export function removeSlugFromRows(
  rows: string[][],
  slug: string,
): string[][] {
  return rows
    .map((row) => row.filter((s) => s !== slug))
    .filter((row) => row.length > 0);
}

function rowIndexOf(rows: string[][], slug: string): number {
  return rows.findIndex((row) => row.includes(slug));
}

/**
 * Place `fromSlug` at `target`. Single entry-point for homepage DnD.
 * If an inline target's row is full, falls back to a solo row beside it.
 */
export function placeCategory(
  rows: string[][],
  fromSlug: string,
  target: CategoryDropTarget,
): string[][] {
  if (target.mode !== "solo-before" && target.anchor === fromSlug) {
    return rows;
  }

  const without = removeSlugFromRows(rows, fromSlug);

  if (target.mode === "solo-before") {
    if (target.anchor === null) return [...without, [fromSlug]];
    const at = rowIndexOf(without, target.anchor);
    if (at < 0) return [...without, [fromSlug]];
    const next = [...without];
    next.splice(at, 0, [fromSlug]);
    return next;
  }

  const at = rowIndexOf(without, target.anchor);
  if (at < 0) return [...without, [fromSlug]];

  const row = [...without[at]!];
  if (row.length >= MAX_CATEGORIES_PER_ROW) {
    const next = [...without];
    const insertAt = target.mode === "inline-before" ? at : at + 1;
    next.splice(insertAt, 0, [fromSlug]);
    return next;
  }

  const anchorPos = row.indexOf(target.anchor);
  const insertAt =
    target.mode === "inline-before" ? anchorPos : anchorPos + 1;
  row.splice(insertAt, 0, fromSlug);
  const next = [...without];
  next[at] = row;
  return next;
}

/** Default migration: each column alone on its own row (classic stacked layout). */
export function soloRowsForCategories(categories: Category[]): string[][] {
  return categories.map((c) => [c.slug]);
}
