import type { DropPosition } from "./bookmark-move";

export const CUSTOM_ORDER_KEY = "pinmark-custom-order";

export interface CustomOrderState {
  folderIds: string[];
  bookmarkIdsByFolder: Record<string, string[]>;
}

export function readCustomOrder(): CustomOrderState {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_ORDER_KEY) || "null") as Partial<CustomOrderState> | null;
    return {
      folderIds: Array.isArray(parsed?.folderIds) ? parsed.folderIds : [],
      bookmarkIdsByFolder: parsed?.bookmarkIdsByFolder && typeof parsed.bookmarkIdsByFolder === "object"
        ? parsed.bookmarkIdsByFolder
        : {},
    };
  } catch {
    return { folderIds: [], bookmarkIdsByFolder: {} };
  }
}

export function writeCustomOrder(order: CustomOrderState): void {
  localStorage.setItem(CUSTOM_ORDER_KEY, JSON.stringify(order));
}

export function orderByIds<T>(items: T[], ids: string[], getId: (item: T) => string): T[] {
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aRank = ranks.get(getId(a));
    const bRank = ranks.get(getId(b));
    if (aRank === undefined && bRank === undefined) return 0;
    if (aRank === undefined) return 1;
    if (bRank === undefined) return -1;
    return aRank - bRank;
  });
}

export function moveIdRelative(
  ids: string[],
  draggedId: string,
  targetId: string,
  position: DropPosition
): string[] {
  const next = ids.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1) return [...next, draggedId];
  next.splice(targetIndex + (position === "after" ? 1 : 0), 0, draggedId);
  return next;
}

export function moveIdToEnd(ids: string[], draggedId: string): string[] {
  return [...ids.filter((id) => id !== draggedId), draggedId];
}
