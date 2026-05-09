import React, { useEffect, useRef } from "react";
import type { BookmarkNode } from "../lib/types";
import BookmarkItem from "./BookmarkItem";

interface Props {
  bookmarks: BookmarkNode[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onMove: (id: string, destinationFolderId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
}

export default function BookmarkList({
  bookmarks,
  selectedIds,
  onToggle,
  onMove,
  onContextMenu,
}: Props) {
  // listen for bookmark-drop events from FolderTree
  const dropHandler = useRef((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.bookmarkId && detail?.destinationId) {
      onMove(detail.bookmarkId, detail.destinationId);
    }
  });

  useEffect(() => {
    const handler = dropHandler.current;
    window.addEventListener("bookmark-drop", handler);
    return () => window.removeEventListener("bookmark-drop", handler);
  }, []);

  if (bookmarks.length === 0) {
    return (
      <div className="bookmark-list-empty">
        <p>这个文件夹是空的</p>
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
        />
      ))}
    </div>
  );
}
