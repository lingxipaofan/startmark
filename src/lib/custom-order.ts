import type { BookmarkNode } from "./types";

// ── Drag-and-drop move & ordering utilities ──
// No persistent custom sort state — Chrome's native bookmark order is the source of truth.

export type DropPosition = "before" | "after";

export interface DragOrderState {
  folderIds: string[];
  bookmarkIdsByFolder: Record<string, string[]>;
}

// ── Move destination calculation ──

export function getRelativeMoveDestination(
  dragged: BookmarkNode,
  target: BookmarkNode,
  position: DropPosition
): { parentId: string; index: number } | null {
  if (!target.parentId || dragged.id === target.id) return null;

  let index = (target.index ?? 0) + (position === "after" ? 1 : 0);
  if (
    dragged.parentId === target.parentId &&
    dragged.index !== undefined &&
    dragged.index < index
  ) {
    index -= 1;
  }

  return { parentId: target.parentId, index: Math.max(0, index) };
}

// ── Preview ordering helpers ──

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
