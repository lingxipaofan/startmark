import React from "react";
import type { BookmarkNode } from "../lib/types";

interface Props {
  bookmark: BookmarkNode;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
}

export default function BookmarkItem({
  bookmark,
  isSelected,
  onToggle,
  onContextMenu,
}: Props) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/bookmark-id", bookmark.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl+Click to select
      onToggle(bookmark.id);
      return;
    }
    if (isSelected) return;
    // open bookmark
    if (bookmark.url) {
      chrome.tabs.create({ url: bookmark.url });
    }
  };

  const favicon = bookmark.url
    ? `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`
    : "";

  return (
    <div
      className={`bookmark-item ${isSelected ? "selected" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, bookmark)}
    >
      <label className="bookmark-checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(bookmark.id)}
        />
      </label>
      <img
        className="bookmark-favicon"
        src={favicon}
        alt=""
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <span className="bookmark-title">{bookmark.title || "无标题"}</span>
      <span className="bookmark-url">{bookmark.url}</span>
    </div>
  );
}
