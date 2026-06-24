import type { BookmarkNode } from "./types";

export type SortMode = "folder" | "custom" | "alphabetical" | "time";
export type AlphabeticalDirection = "asc" | "desc";

export const SORT_MODE_KEY = "pinmark-grid-sort-mode";
export const ALPHABETICAL_DIRECTION_KEY = "pinmark-alphabetical-direction";

export function readSortMode(): SortMode {
  const stored = localStorage.getItem(SORT_MODE_KEY);
  return stored === "custom" || stored === "alphabetical" || stored === "time" ? stored : "folder";
}

export function readAlphabeticalDirection(): AlphabeticalDirection {
  return localStorage.getItem(ALPHABETICAL_DIRECTION_KEY) === "desc" ? "desc" : "asc";
}

export function sortBookmarkNodes(
  nodes: BookmarkNode[],
  mode: SortMode,
  direction: AlphabeticalDirection
): BookmarkNode[] {
  if (mode === "folder" || mode === "custom") return nodes;

  const result = [...nodes];
  if (mode === "time") {
    return result.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
  }

  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  const multiplier = direction === "asc" ? 1 : -1;
  return result.sort(
    (a, b) => multiplier * collator.compare(a.title || a.url || "", b.title || b.url || "")
  );
}
