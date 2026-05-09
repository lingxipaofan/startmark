import React, { useState } from "react";
import type { BookmarkNode } from "../lib/types";

interface Props {
  tree: BookmarkNode[];
  selectedFolder: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
}

export default function FolderTree({ tree, selectedFolder, onSelect, onContextMenu }: Props) {
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
}: {
  node: BookmarkNode;
  depth: number;
  selectedFolder: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const bookmarkId = e.dataTransfer.getData("text/bookmark-id");
    if (bookmarkId) {
      onSelect(node.id);
      // dispatch a custom event for the move
      window.dispatchEvent(
        new CustomEvent("bookmark-drop", {
          detail: { bookmarkId, destinationId: node.id },
        })
      );
    }
  };

  return (
    <div>
      <div
        className={`folder-item ${selectedFolder === node.id ? "selected" : ""} ${dragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => onContextMenu(e, node)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
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
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
