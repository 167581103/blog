/** Lightweight relative labels for editor save state. */
export function formatEditStamp(atMs: number | null | undefined, now = Date.now()) {
  if (atMs == null || Number.isNaN(atMs)) return null;

  const delta = Math.max(0, now - atMs);
  if (delta < 45_000) return "Just now";
  if (delta < 60 * 60_000) {
    const minutes = Math.max(1, Math.round(delta / 60_000));
    return `${minutes}m ago`;
  }
  if (delta < 24 * 60 * 60_000) {
    const hours = Math.max(1, Math.round(delta / (60 * 60_000)));
    return `${hours}h ago`;
  }

  return `Edited ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(atMs))}`;
}

export function formatReleaseDate(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}
