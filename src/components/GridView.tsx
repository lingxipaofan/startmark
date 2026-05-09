import React, { useState, useEffect, useRef, useMemo } from "react";
import type { BookmarkNode } from "../lib/types";
import ContextMenu from "./ContextMenu";

interface Props {
  tree: BookmarkNode[];
  searchQuery: string;
  onMove: (id: string, destinationFolderId: string) => void;
  onDeleteSelected: (ids: string[]) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
}

interface FolderSection {
  folder: BookmarkNode;
  bookmarks: BookmarkNode[];
}

type SortMode = "folder" | "time";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

function timeBucket(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return "本周";
  if (months < 1) return `${days} 天前`;      // 2-6天
  if (years === 0) return `${months} 个月前`;  // 1-11个月
  if (years === 1) return "去年";
  if (years === 2) return "前年";
  return `${years} 年前`;
}

export default function GridView({
  tree,
  searchQuery,
  onMove,
  onDeleteSelected,
  onContextMenu,
}: Props) {
  const [sections, setSections] = useState<FolderSection[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("folder");
  const dragBookmark = useRef<{ id: string; parentId?: string } | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // context menu for folder headers
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; node: BookmarkNode } | null>(null);

  // Build folder sections — each folder becomes a column
  useEffect(() => {
    const result: FolderSection[] = [];
    const seen = new Set<string>();
    const walk = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (node.children && !seen.has(node.id)) {
          seen.add(node.id);
          const allBms: BookmarkNode[] = [];
          // collect all descendant bookmarks for this folder
          const collect = (items: BookmarkNode[]) => {
            for (const c of items) {
              if (c.url) allBms.push(c);
              if (c.children) collect(c.children);
            }
          };
          collect(node.children);
          if (allBms.length > 0) {
            result.push({ folder: node, bookmarks: allBms });
          }
          walk(node.children);
        }
      }
    };
    walk(tree);
    result.sort((a, b) => {
      if (a.folder.id === "1") return -1;
      if (b.folder.id === "1") return 1;
      return a.folder.title.localeCompare(b.folder.title);
    });
    setSections(result);
  }, [tree]);

  useEffect(() => {
    if (!showFolderPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowFolderPicker(false);
      }
    };
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [showFolderPicker]);

  // Close folder context menu
  useEffect(() => {
    if (!folderMenu) return;
    const close = () => setFolderMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [folderMenu]);

  // Time-sorted flat list — oldest first
  const timeSortedBookmarks = useMemo(() => {
    const all: BookmarkNode[] = [];
    for (const s of sections) {
      for (const b of s.bookmarks) all.push(b);
    }
    all.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0)); // oldest first
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return all.filter(
        (b) => b.title.toLowerCase().includes(q) || (b.url || "").toLowerCase().includes(q)
      );
    }
    return all;
  }, [sections, searchQuery]);

  // Group by time bucket — oldest groups first
  const timeGroups = useMemo(() => {
    const map = new Map<string, BookmarkNode[]>();
    for (const b of timeSortedBookmarks) {
      const bucket = timeBucket(b.dateAdded || 0);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(b);
    }
    return Array.from(map.entries())
      .map(([label, bookmarks]) => ({
        label,
        bookmarks,
        sortKey: Math.min(...bookmarks.map((b) => b.dateAdded || 0)),
      }))
      .sort((a, b) => a.sortKey - b.sortKey); // oldest group first
  }, [timeSortedBookmarks]);

  const filteredSections = searchQuery
    ? sections
        .map((s) => ({
          ...s,
          bookmarks: s.bookmarks.filter(
            (b) =>
              b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (b.url || "").toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((s) => s.bookmarks.length > 0)
    : sections;

  const totalSelected = selectedIds.size;

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardClick = (e: React.MouseEvent, bm: BookmarkNode) => {
    if ((e.target as HTMLElement).closest(".grid-card-check")) {
      toggleSelect(bm.id);
      return;
    }
    if (totalSelected > 0) {
      toggleSelect(bm.id);
      return;
    }
    if (bm.url) chrome.tabs.create({ url: bm.url });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    const items = sortMode === "folder" ? filteredSections : timeGroups;
    for (const s of items) {
      for (const b of s.bookmarks) all.add(b.id);
    }
    setSelectedIds(all);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSelected = () => {
    if (totalSelected === 0) return;
    onDeleteSelected([...selectedIds]);
    clearSelection();
  };

  const handleMoveSelected = (destFolderId: string) => {
    for (const id of selectedIds) onMove(id, destFolderId);
    clearSelection();
    setShowFolderPicker(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragBookmark.current = { id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleSectionDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    if (dragBookmark.current) {
      onMove(dragBookmark.current.id, folderId);
      dragBookmark.current = null;
    }
  };

  const folderList = useMemo(() => {
    const folders: { id: string; title: string }[] = [];
    const walk = (nodes: BookmarkNode[]) => {
      for (const n of nodes) {
        if (n.children && n.id !== "0") {
          folders.push({ id: n.id, title: n.title });
          walk(n.children);
        }
      }
    };
    walk(tree);
    return folders;
  }, [tree]);

  const handleFolderRightClick = (e: React.MouseEvent, node: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.id === "0" || node.id === "1") return;
    setFolderMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleFolderMenuAction = (action: string) => {
    if (action === "delete-folder" && folderMenu) {
      chrome.bookmarks.removeTree(folderMenu.node.id).then(() => window.location.reload());
    }
    setFolderMenu(null);
  };

  const hasItems = sortMode === "folder" ? filteredSections.length > 0 : timeGroups.length > 0;

  if (!hasItems) {
    return (
      <div className="grid-view-empty">
        <p>{searchQuery ? "没有匹配的书签" : "暂无书签"}</p>
      </div>
    );
  }

  return (
    <div className="grid-view">
      {/* Sort toggle */}
      <div className="grid-sort-bar">
        <button
          className={`sort-btn ${sortMode === "folder" ? "active" : ""}`}
          onClick={() => { setSortMode("folder"); clearSelection(); }}
        >
          📁 按文件夹
        </button>
        <button
          className={`sort-btn ${sortMode === "time" ? "active" : ""}`}
          onClick={() => { setSortMode("time"); clearSelection(); }}
        >
          🕐 按收藏时间
        </button>
      </div>

      {/* Batch toolbar */}
      {totalSelected > 0 && (
        <div className="grid-batch-bar">
          <span className="grid-batch-info">已选择 {totalSelected} 项</span>
          <button className="batch-btn" onClick={selectAll}>☐ 全选</button>
          <button className="batch-btn batch-btn-danger" onClick={handleDeleteSelected}>🗑 删除选中</button>
          <div className="batch-move-wrap" ref={pickerRef}>
            <button className="batch-btn" onClick={() => setShowFolderPicker(!showFolderPicker)}>
              📂 移动到...
            </button>
            {showFolderPicker && (
              <div className="batch-folder-picker">
                {folderList.map((f) => (
                  <div key={f.id} className="batch-folder-item" onClick={() => handleMoveSelected(f.id)}>
                    📁 {f.title}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="batch-btn batch-btn-cancel" onClick={clearSelection}>✕ 取消</button>
        </div>
      )}

      {/* Folder mode */}
      {sortMode === "folder" &&
        filteredSections.map((section) => (
          <div
            key={section.folder.id}
            className={`grid-section ${dragOverFolder === section.folder.id ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverFolder(section.folder.id); }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={(e) => handleSectionDrop(e, section.folder.id)}
          >
            <div
              className="grid-section-header"
              onClick={() => toggleSection(section.folder.id)}
              onContextMenu={(e) => handleFolderRightClick(e, section.folder)}
            >
              <span className="grid-section-toggle">
                {collapsedSections.has(section.folder.id) ? "▶" : "▼"}
              </span>
              <span className="grid-section-icon">📁</span>
              <h2 className="grid-section-title">{section.folder.title}</h2>
              <span className="grid-section-count">{section.bookmarks.length}</span>
            </div>
            {!collapsedSections.has(section.folder.id) && (
              <div className="grid-section-body">
                <FolderContent
                  folder={section.folder}
                  depth={0}
                  selectedIds={selectedIds}
                  totalSelected={totalSelected}
                  searchQuery={searchQuery}
                  onCardClick={handleCardClick}
                  onToggleSelect={toggleSelect}
                  onDragStart={handleDragStart}
                  onContextMenu={onContextMenu}
                  onMove={onMove}
                />
              </div>
            )}
          </div>
        ))}

      {/* Time mode */}
      {sortMode === "time" &&
        timeGroups.map((group) => (
          <div key={group.label} className="grid-section">
            <div className="grid-section-header">
              <span className="grid-section-icon">🕐</span>
              <h2 className="grid-section-title">{group.label}</h2>
              <span className="grid-section-count">{group.bookmarks.length}</span>
            </div>
            <div className="grid-section-body">
              {group.bookmarks.map((bm) => (
                <BookmarkCard
                  key={bm.id}
                  bm={bm}
                  isSelected={selectedIds.has(bm.id)}
                  timeLabel={relativeTime(bm.dateAdded || 0)}
                  onDragStart={handleDragStart}
                  onClick={handleCardClick}
                  onContextMenu={onContextMenu}
                />
              ))}
            </div>
          </div>
        ))}

      {/* Folder right-click menu */}
      {folderMenu && (
        <div
          className="context-menu"
          style={{ left: folderMenu.x, top: folderMenu.y, position: "fixed" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => handleFolderMenuAction("delete-folder")}>
            删除文件夹
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Recursive folder content renderer ───

function FolderContent({
  folder,
  depth,
  selectedIds,
  totalSelected,
  searchQuery,
  onCardClick,
  onToggleSelect,
  onDragStart,
  onContextMenu,
  onMove,
}: {
  folder: BookmarkNode;
  depth: number;
  selectedIds: Set<string>;
  totalSelected: number;
  searchQuery: string;
  onCardClick: (e: React.MouseEvent, bm: BookmarkNode) => void;
  onToggleSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onMove: (id: string, destId: string) => void;
}) {
  const [dragOverSub, setDragOverSub] = useState<string | null>(null);
  if (!folder.children || folder.children.length === 0) return null;

  const items: React.ReactNode[] = [];
  for (const child of folder.children) {
    if (child.url) {
      // Bookmark leaf node
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        child.title.toLowerCase().includes(q) ||
        (child.url || "").toLowerCase().includes(q);
      if (!matchesSearch) continue;

      items.push(
        <BookmarkCard
          key={child.id}
          bm={child}
          isSelected={selectedIds.has(child.id)}
          depth={depth}
          onDragStart={onDragStart}
          onClick={onCardClick}
          onContextMenu={onContextMenu}
        />
      );
    } else if (child.children) {
      // Sub-folder: show as indented group
      // Count visible bookmarks inside
      let visibleCount = 0;
      const countBms = (nodes: BookmarkNode[]) => {
        for (const n of nodes) {
          if (n.url) {
            if (!searchQuery) visibleCount++;
            else {
              const q = searchQuery.toLowerCase();
              if (n.title.toLowerCase().includes(q) || (n.url || "").toLowerCase().includes(q)) visibleCount++;
            }
          }
          if (n.children) countBms(n.children);
        }
      };
      countBms(child.children);
      if (visibleCount === 0) continue;

      const subId = `sub-${child.id}-${depth}`;
      items.push(
        <div
          key={subId}
          className={`grid-sub-group ${dragOverSub === child.id ? "drag-over" : ""}`}
          style={{ paddingLeft: `${depth * 14}px` }}
          onDragOver={(e) => { e.preventDefault(); setDragOverSub(child.id); }}
          onDragLeave={() => setDragOverSub(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverSub(null);
            const id = dragRef.current;
            if (id) onMove(id, child.id);
          }}
        >
          <div className="grid-sub-header" title={`${child.title} — ${visibleCount} 个书签`}>
            <span className="grid-sub-icon">📁</span>
            <span className="grid-sub-title">{child.title}</span>
            <span className="grid-sub-count">{visibleCount}</span>
          </div>
          <FolderContent
            folder={child}
            depth={depth + 1}
            selectedIds={selectedIds}
            totalSelected={totalSelected}
            searchQuery={searchQuery}
            onCardClick={onCardClick}
            onToggleSelect={onToggleSelect}
            onDragStart={onDragStart}
            onContextMenu={onContextMenu}
            onMove={onMove}
          />
        </div>
      );
    }
  }
  return <>{items}</>;
}

// HACK: global ref for drag data between components
const dragRef = { current: "" };

// ─── Bookmark Card ───

function BookmarkCard({
  bm,
  isSelected,
  timeLabel,
  depth = 0,
  onDragStart,
  onClick,
  onContextMenu,
}: {
  bm: BookmarkNode;
  isSelected: boolean;
  timeLabel?: string;
  depth?: number;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: (e: React.MouseEvent, bm: BookmarkNode) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
}) {
  return (
    <div
      className={`grid-card ${isSelected ? "selected" : ""}`}
      style={depth > 0 ? { paddingLeft: `${12 + depth * 14}px` } : undefined}
      draggable
      onDragStart={(e) => {
        dragRef.current = bm.id;
        onDragStart(e, bm.id);
      }}
      onClick={(e) => onClick(e, bm)}
      onContextMenu={(e) => onContextMenu(e, bm)}
      title={`${bm.title}\n${bm.url}${timeLabel ? `\n收藏: ${timeLabel}` : ""}`}
    >
      <span className="grid-card-check">
        {isSelected ? "◉" : "○"}
      </span>
      <img
        className="grid-card-favicon"
        src={bm.url ? `https://www.google.com/s2/favicons?domain=${new URL(bm.url).hostname}&sz=32` : ""}
        alt=""
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span className="grid-card-title">{bm.title || "无标题"}</span>
      {timeLabel && <span className="grid-card-time">{timeLabel}</span>}
    </div>
  );
}
