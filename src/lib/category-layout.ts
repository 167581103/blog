import type { Category } from "./types";

export const MAX_CATEGORIES_PER_ROW = 3;

/** Homepage column layout — rows of 1–3 category slugs. */
export type CategoryLayout = {
  categories: Category[];
  rows: string[][];
};

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

/** Move `fromSlug` before `beforeSlug` (same or other row). */
export function moveCategoryBefore(
  rows: string[][],
  fromSlug: string,
  beforeSlug: string,
): string[][] {
  if (fromSlug === beforeSlug) return rows;
  const without = removeSlugFromRows(rows, fromSlug);
  const targetRow = without.findIndex((row) => row.includes(beforeSlug));
  if (targetRow < 0) return rows;

  const row = [...without[targetRow]!];
  if (row.length >= MAX_CATEGORIES_PER_ROW) {
    // Target row is full — park as its own row just above.
    const next = [...without];
    next.splice(targetRow, 0, [fromSlug]);
    return next;
  }

  const at = row.indexOf(beforeSlug);
  row.splice(at, 0, fromSlug);
  const next = [...without];
  next[targetRow] = row;
  return next;
}

/** Append to a row when it still has room. */
export function appendCategoryToRow(
  rows: string[][],
  fromSlug: string,
  rowIndex: number,
): string[][] {
  const without = removeSlugFromRows(rows, fromSlug);
  if (rowIndex < 0 || rowIndex >= without.length) {
    return [...without, [fromSlug]];
  }
  const row = [...without[rowIndex]!];
  if (row.length >= MAX_CATEGORIES_PER_ROW) return rows;
  if (row.includes(fromSlug)) return rows;
  row.push(fromSlug);
  const next = [...without];
  next[rowIndex] = row;
  return next;
}

/** Insert `fromSlug` as a brand-new solo row at `rowIndex`. */
export function insertCategoryAsRow(
  rows: string[][],
  fromSlug: string,
  rowIndex: number,
): string[][] {
  const without = removeSlugFromRows(rows, fromSlug);
  const next = [...without];
  const at = Math.max(0, Math.min(rowIndex, next.length));
  next.splice(at, 0, [fromSlug]);
  return next;
}

/** Default migration: each column alone on its own row (classic stacked layout). */
export function soloRowsForCategories(categories: Category[]): string[][] {
  return categories.map((c) => [c.slug]);
}
