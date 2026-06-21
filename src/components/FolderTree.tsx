import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BookmarkNode } from "../lib/types";
import { useI18n } from "../lib/i18n";
import {
  sortBookmarkNodes,
  type AlphabeticalDirection,
  type SortMode,
} from "../lib/bookmark-sort";

interface Props {
  tree: BookmarkNode[];
  selectedFolder: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onDropBookmarks?: (bookmarkIds: string[], destinationFolderId: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  sortMode: SortMode;
  alphabeticalDirection: AlphabeticalDirection;
}

// Module-level tracker for the folder being dragged (shared across recursive instances)
let _dragFolderId: string | null = null;

export default function FolderTree({
  tree,
  selectedFolder,
  onSelect,
  onContextMenu,
  onDropBookmarks,
  onRename,
  sortMode,
  alphabeticalDirection,
}: Props) {
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
          onRename={onRename}
          sortMode={sortMode}
          alphabeticalDirection={alphabeticalDirection}
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
  onRename,
  sortMode,
  alphabeticalDirection,
  ancestorIds,
}: {
  node: BookmarkNode;
  depth: number;
  selectedFolder: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onDropBookmarks?: (bookmarkIds: string[], destinationFolderId: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  sortMode: SortMode;
  alphabeticalDirection: AlphabeticalDirection;
  ancestorIds: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelEditRef = useRef(false);
  const { t } = useI18n();
  const canRename = node.parentId !== "0";
  const childFolders = useMemo(
    () => sortBookmarkNodes(
      (node.children || []).filter((child) => !!child.children),
      sortMode,
      alphabeticalDirection
    ),
    [node.children, sortMode, alphabeticalDirection]
  );
  const hasChildFolders = childFolders.length > 0;

  useEffect(() => {
    if (!isEditing) setDraftTitle(node.title);
  }, [node.title, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

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

  const startEditing = (e: React.MouseEvent) => {
    if (!canRename) return;
    e.preventDefault();
    e.stopPropagation();
    cancelEditRef.current = false;
    setDraftTitle(node.title);
    setIsEditing(true);
  };

  const commitRename = async () => {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }
    const title = draftTitle.trim();
    if (!title || title === node.title) {
      setDraftTitle(node.title);
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onRename(node.id, title);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="folder-node">
      <div
        className={`folder-item ${selectedFolder === node.id ? "selected" : ""} ${dragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${12 + depth * 24}px` }}
        onClick={() => { if (!isEditing) onSelect(node.id); }}
        onDoubleClick={startEditing}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={canDrag && !isEditing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasChildFolders && (
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
        {isEditing ? (
          <input
            ref={inputRef}
            className="folder-title-input"
            value={draftTitle}
            disabled={isSaving}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={() => { void commitRename(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                cancelEditRef.current = true;
                setDraftTitle(node.title);
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <span className="folder-title">{node.title}</span>
        )}
        {node.id === "1" && (
          <span className="folder-badge">{t("bookmark_bar")}</span>
        )}
      </div>
      {hasChildFolders && !collapsed && (
        <div>
          {childFolders.map((child) =>
            (
              <FolderNode
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedFolder={selectedFolder}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                onDropBookmarks={onDropBookmarks}
                onRename={onRename}
                sortMode={sortMode}
                alphabeticalDirection={alphabeticalDirection}
                ancestorIds={new Set([...ancestorIds, node.id])}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
