import React, { useEffect, useRef, useCallback } from "react";
import type { BookmarkNode, LinkStatus } from "../lib/types";
import BookmarkItem from "./BookmarkItem";
import { useI18n } from "../lib/i18n";

interface Props {
  bookmarks: BookmarkNode[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onMove: (id: string, destinationFolderId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  getLinkStatus?: (id: string) => LinkStatus;
}

export default function BookmarkList({
  bookmarks,
  selectedIds,
  onToggle,
  onMove,
  onContextMenu,
  getLinkStatus,
}: Props) {
  const { t } = useI18n();
  const bookmarksRef = useRef(bookmarks);

  // Keep ref in sync
  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  // Shift-click range selection
  const shiftSelectHandler = useCallback((e: Event) => {
    const { fromId, toId } = (e as CustomEvent).detail;
    const items = bookmarksRef.current;
    const fromIdx = items.findIndex((b) => b.id === fromId);
    const toIdx = items.findIndex((b) => b.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    for (let i = start; i <= end; i++) {
      onToggle(items[i].id);
    }
  }, [onToggle]);

  useEffect(() => {
    window.addEventListener("bookmark-shift-select", shiftSelectHandler);
    return () => window.removeEventListener("bookmark-shift-select", shiftSelectHandler);
  }, [shiftSelectHandler]);

  if (bookmarks.length === 0) {
    return (
      <div className="bookmark-list-empty">
        <p>{t("folder_empty")}</p>
      </div>
    );
  }

  return (
    <div className="bookmark-list">
      {bookmarks.map((bm) => (
        <BookmarkItem
          key={bm.id}
          bookmark={bm}
          isSelected={selectedIds.has(bm.id)}
          onToggle={onToggle}
          onContextMenu={onContextMenu}
          linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
        />
      ))}
    </div>
  );
}
