import type { BookmarkNode } from "./types";

export type DropPosition = "before" | "after";

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
