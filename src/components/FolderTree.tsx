import React, { useState } from "react";
import type { BookmarkNode } from "../lib/types";

interface Props {
  tree: BookmarkNode[];
  selectedFolder: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onDropBookmarks?: (bookmarkIds: string[], destinationFolderId: string) => void;
}

// Module-level tracker for the folder being dragged (shared across recursive instances)
let _dragFolderId: string | null = null;

export default function FolderTree({ tree, selectedFolder, onSelect, onContextMenu, onDropBookmarks }: Props) {
  return (
    <div className="folder-tree">
      {tree.map((node) => (
        <FolderNode
          key={node.id}
          node={node}
          depth={0}
          selectedFolder={selectedFolder}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onDropBookmarks={onDropBookmarks}
          ancestorIds={new Set()}
        />
      ))}
    </div>
  );
}

function FolderNode({
  node,
  depth,
  selectedFolder,
  onSelect,
  onContextMenu,
  onDropBookmarks,
  ancestorIds,
}: {
  node: BookmarkNode;
  depth: number;
  selectedFolder: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onDropBookmarks?: (bookmarkIds: string[], destinationFolderId: string) => void;
  ancestorIds: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const canDrag = node.id !== "0" && node.id !== "1";
  // Dropping on self or on a descendant of the dragged folder → invalid
  const isInvalidTarget = _dragFolderId !== null &&
    (node.id === _dragFolderId || ancestorIds.has(_dragFolderId));

  const handleDragStart = (e: React.DragEvent) => {
    _dragFolderId = node.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify([node.id]));
  };

  const handleDragEnd = () => {
    _dragFolderId = null;
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isInvalidTarget) return;
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const ids: string[] = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length > 0) {
        onSelect(node.id);
        if (onDropBookmarks) {
          onDropBookmarks(ids, node.id);
        }
      }
    } catch {
      // Single ID fallback (legacy format)
      onSelect(node.id);
      if (onDropBookmarks) {
        onDropBookmarks([raw], node.id);
      }
    }
    _dragFolderId = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isInvalidTarget) {
      setDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div>
      <div
        className={`folder-item ${selectedFolder === node.id ? "selected" : ""} ${dragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={canDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasChildren && (
          <span
            className="folder-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
          >
            {collapsed ? "▶" : "▼"}
          </span>
        )}
        <span className="folder-icon">📁</span>
        <span className="folder-title">{node.title}</span>
        {node.title === "书签栏" && (
          <span className="folder-badge">书签栏</span>
        )}
      </div>
      {hasChildren && !collapsed && (
        <div>
          {node.children!.map((child) =>
            child.children ? (
              <FolderNode
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedFolder={selectedFolder}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                onDropBookmarks={onDropBookmarks}
                ancestorIds={new Set([...ancestorIds, node.id])}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
