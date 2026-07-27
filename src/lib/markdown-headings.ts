/** Shared heading outline helpers for read + edit. */

export type OutlineHeading = {
  level: 1 | 2 | 3;
  text: string;
  id: string;
};

/** Strip simple markdown markers for outline labels / slug bases. */
export function plainHeadingText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyHeading(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "section";

  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

/**
 * Collect ATX headings (#–###) outside fenced code blocks.
 * Ids are stable for a given document order (same algorithm as Markdown render).
 */
export function extractMarkdownOutline(markdown: string): OutlineHeading[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const headings: OutlineHeading[] = [];
  const used = new Set<string>();
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line.trimStart())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const level = match[1]!.length as 1 | 2 | 3;
    const text = plainHeadingText(match[2] || "");
    if (!text) continue;
    headings.push({
      level,
      text,
      id: slugifyHeading(text, used),
    });
  }

  return headings;
}
