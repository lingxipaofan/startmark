import React, { useState, useEffect, useRef, useMemo } from "react";
import type { BookmarkNode, LinkStatus } from "../lib/types";
import { useI18n, formatRelativeTime, timeBucket } from "../lib/i18n";

interface Props {
  tree: BookmarkNode[];
  searchQuery: string;
  onMove: (id: string, destinationFolderId: string) => void;
  onDeleteSelected: (ids: string[]) => void;
  onDeleteFolder?: (folderId: string, folderTitle: string) => void;
  onCreateSubFolder?: (parentId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onRename?: (id: string, currentTitle: string) => void;
  onCheckLinks?: () => void;
  onRecheckBroken?: () => void;
  isCheckingLinks?: boolean;
  brokenCount?: number;
  lastCheckedAt?: number | null;
  getLinkStatus?: (id: string) => LinkStatus;
}

interface FolderSection {
  folder: BookmarkNode;
  bookmarks: BookmarkNode[];
  breadcrumb: string[]; // ancestor titles, e.g. ["书签栏", "工作"]
}

type SortMode = "folder" | "time";

export default function GridView({
  tree,
  searchQuery,
  onMove,
  onDeleteSelected,
  onDeleteFolder,
  onCreateSubFolder,
  onContextMenu,
  onRename,
  onCheckLinks,
  onRecheckBroken,
  isCheckingLinks,
  brokenCount,
  lastCheckedAt,
  getLinkStatus,
}: Props) {
  const { t } = useI18n();
  const [sections, setSections] = useState<FolderSection[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("folder");
  const dragData = useRef<string[] | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; node: BookmarkNode } | null>(null);

  // Build sections: each folder with bookmarks or sub-folders = one column
  useEffect(() => {
    const result: FolderSection[] = [];
    const walk = (nodes: BookmarkNode[], ancestors: BookmarkNode[] = []) => {
      for (const node of nodes) {
        if (!node.children) continue;
        const directBms = node.children.filter((c) => !!c.url);
        const hasSubFolders = node.children.some((c) => !!c.children);
        if (directBms.length > 0 || hasSubFolders) {
          result.push({
            folder: node,
            bookmarks: directBms,
            breadcrumb: ancestors.map((a) => a.title),
          });
        }
        walk(node.children, [...ancestors, node]);
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

  useEffect(() => {
    if (!folderMenu) return;
    const close = () => setFolderMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [folderMenu]);

  // Listen for keyboard events from App
  useEffect(() => {
    const onSelectAll = () => selectAll();
    const onDelete = () => handleDeleteSelected();
    window.addEventListener("grid-select-all", onSelectAll);
    window.addEventListener("grid-delete-selected", onDelete);
    return () => {
      window.removeEventListener("grid-select-all", onSelectAll);
      window.removeEventListener("grid-delete-selected", onDelete);
    };
  }, [sections, sortMode, selectedIds]);

  // Time-sorted — oldest first
  const timeSortedBookmarks = useMemo(() => {
    const all: BookmarkNode[] = [];
    for (const s of sections) {
      for (const b of s.bookmarks) all.push(b);
    }
    all.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return all.filter(
        (b) => b.title.toLowerCase().includes(q) || (b.url || "").toLowerCase().includes(q)
      );
    }
    return all;
  }, [sections, searchQuery]);

  const timeGroups = useMemo(() => {
    const map = new Map<string, BookmarkNode[]>();
    for (const b of timeSortedBookmarks) {
      const bucket = timeBucket(b.dateAdded || 0, t);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(b);
    }
    return Array.from(map.entries())
      .map(([label, bookmarks]) => ({
        label,
        bookmarks,
        sortKey: Math.min(...bookmarks.map((b) => b.dateAdded || 0)),
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [timeSortedBookmarks, t]);

  // Filter sections by search
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
    // Visit button click is handled separately
    if ((e.target as HTMLElement).closest(".grid-card-visit")) return;
    // Checkbox toggles selection
    if ((e.target as HTMLElement).closest(".grid-card-check")) {
      toggleSelect(bm.id);
      return;
    }
    // Shift+click for range selection
    if (e.shiftKey && selectedIds.size > 0) {
      const items = sortMode === "folder"
        ? filteredSections.flatMap((s) => s.bookmarks)
        : timeGroups.flatMap((g) => g.bookmarks);
      const lastSelected = [...selectedIds].pop()!;
      const lastIdx = items.findIndex((b) => b.id === lastSelected);
      const curIdx = items.findIndex((b) => b.id === bm.id);
      if (lastIdx !== -1 && curIdx !== -1) {
        const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(items[i].id);
          return next;
        });
      }
      return;
    }
    // Default: toggle selection
    toggleSelect(bm.id);
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
    const ids = selectedIds.has(id) && selectedIds.size > 1
      ? [...selectedIds]
      : [id];
    dragData.current = ids;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(ids));
  };

  const handleSectionDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    let ids = dragData.current;
    // If not dragging from within GridView, try reading from dataTransfer
    if (!ids) {
      const raw = e.dataTransfer.getData("text/plain");
      if (raw) {
        try { ids = JSON.parse(raw); } catch { ids = [raw]; }
      }
    }
    if (ids) {
      for (const id of ids) {
        if (id !== folderId) onMove(id, folderId);
      }
      dragData.current = null;
    }
  };

  // All folders flat list for move picker
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
    if (!folderMenu) return;
    if (action === "delete-folder") {
      if (onDeleteFolder) {
        onDeleteFolder(folderMenu.node.id, folderMenu.node.title);
      } else {
        chrome.bookmarks.removeTree(folderMenu.node.id).then(() => window.location.reload());
      }
    }
    if (action === "create-sub-folder") {
      if (onCreateSubFolder) {
        onCreateSubFolder(folderMenu.node.id);
      }
    }
    if (action === "rename-folder") {
      if (onRename) {
        onRename(folderMenu.node.id, folderMenu.node.title);
      }
    }
    setFolderMenu(null);
  };

  const hasItems = sortMode === "folder" ? filteredSections.length > 0 : timeGroups.length > 0;

  if (!hasItems) {
    return (
      <div className="grid-view-empty">
        <p>{searchQuery ? t("no_matching") : t("no_bookmarks")}</p>
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
          {t("sort_by_folder")}
        </button>
        <button
          className={`sort-btn ${sortMode === "time" ? "active" : ""}`}
          onClick={() => { setSortMode("time"); clearSelection(); }}
        >
          {t("sort_by_time")}
        </button>
        <div className="grid-sort-spacer" />
        <button
          className={`sort-btn link-check-btn ${isCheckingLinks ? "checking" : ""}`}
          onClick={onCheckLinks}
          disabled={isCheckingLinks}
        >
          {isCheckingLinks ? "⏳" : "🔗"} {t("check_links")}
        </button>
        {brokenCount !== undefined && brokenCount > 0 && !isCheckingLinks && (
          <>
            <button
              className="sort-btn link-recheck-btn"
              onClick={onRecheckBroken}
            >
              🔄 {t("recheck_broken")}
            </button>
            <button
              className="sort-btn link-broken-btn"
              onClick={() => {
                const all = new Set<string>();
                for (const s of (sortMode === "folder" ? filteredSections : timeGroups)) {
                  for (const b of s.bookmarks) {
                    if (getLinkStatus && getLinkStatus(b.id) === "broken") all.add(b.id);
                  }
                }
                setSelectedIds(all);
              }}
            >
              ⚠️ {t("broken_found", { count: brokenCount })}
            </button>
          </>
        )}
        {lastCheckedAt && !isCheckingLinks && (
          <span className="last-checked-hint">{t("last_checked", { time: formatRelativeTime(lastCheckedAt, t) })}</span>
        )}
      </div>

      {/* Batch toolbar */}
      {totalSelected > 0 && (
        <div className="grid-batch-bar">
          <span className="grid-batch-info">{t("selected_items", { count: totalSelected })}</span>
          <button className="batch-btn" onClick={selectAll}>{t("select_all")}</button>
          <button className="batch-btn batch-btn-danger" onClick={handleDeleteSelected}>{t("delete_selected")}</button>
          <div className="batch-move-wrap" ref={pickerRef}>
            <button className="batch-btn" onClick={() => setShowFolderPicker(!showFolderPicker)}>
              {t("move_to")}
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
          <button className="batch-btn batch-btn-cancel" onClick={clearSelection}>{t("cancel")}</button>
        </div>
      )}

      {/* Folder mode — each folder = one column */}
      {sortMode === "folder" &&
        filteredSections.map((section) => (
          <div
            key={section.folder.id}
            data-folder-id={section.folder.id}
            className={`grid-section ${dragOverFolder === section.folder.id ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverFolder(section.folder.id); }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={(e) => handleSectionDrop(e, section.folder.id)}
          >
            <div
              className="grid-section-header"
              onClick={() => toggleSection(section.folder.id)}
              onContextMenu={(e) => handleFolderRightClick(e, section.folder)}
              draggable={section.folder.id !== "0" && section.folder.id !== "1"}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", JSON.stringify([section.folder.id]));
                // Reduce opacity during drag for visual feedback
                (e.target as HTMLElement).closest(".grid-section")?.classList.add("dragging");
              }}
              onDragEnd={(e) => {
                (e.target as HTMLElement).closest(".grid-section")?.classList.remove("dragging");
              }}
            >
              <span className="grid-section-toggle">
                {collapsedSections.has(section.folder.id) ? "▶" : "▼"}
              </span>
              <span className="grid-section-icon">📁</span>
              <div className="grid-section-title-wrap">
                <h2 className="grid-section-title">{section.folder.title}</h2>
                {section.breadcrumb.length > 0 && (
                  <span className="grid-section-breadcrumb">
                    {section.breadcrumb.join(" › ")}
                  </span>
                )}
              </div>
              <span className="grid-section-count">{section.bookmarks.length}</span>
            </div>
            {!collapsedSections.has(section.folder.id) && (
              <div className="grid-section-body">
                {section.bookmarks.map((bm) => (
                  <BookmarkCard
                    key={bm.id}
                    bm={bm}
                    isSelected={selectedIds.has(bm.id)}
                    onDragStart={handleDragStart}
                    onClick={handleCardClick}
                    onContextMenu={onContextMenu}
                    linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
                  />
                ))}
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
                  timeLabel={formatRelativeTime(bm.dateAdded || 0, t)}
                  onDragStart={handleDragStart}
                  onClick={handleCardClick}
                  onContextMenu={onContextMenu}
                  linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
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
          <div className="context-menu-item" onClick={() => handleFolderMenuAction("create-sub-folder")}>
            {t("new_subfolder")}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => handleFolderMenuAction("rename-folder")}>
            {t("rename")}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => handleFolderMenuAction("delete-folder")}>
            {t("delete_folder")}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bookmark Card ───

function safeFaviconUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch {
    return "";
  }
}

function BookmarkCard({
  bm,
  isSelected,
  timeLabel,
  onDragStart,
  onClick,
  onContextMenu,
  linkStatus: status,
}: {
  bm: BookmarkNode;
  isSelected: boolean;
  timeLabel?: string;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: (e: React.MouseEvent, bm: BookmarkNode) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  linkStatus?: LinkStatus;
}) {
  const { t } = useI18n();

  const handleVisit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bm.url) chrome.tabs.create({ url: bm.url });
  };

  return (
    <div
      className={`grid-card ${isSelected ? "selected" : ""} ${status !== "unknown" ? `link-${status}` : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, bm.id)}
      onClick={(e) => onClick(e, bm)}
      onContextMenu={(e) => onContextMenu(e, bm)}
      title={`${bm.title}\n${bm.url}${timeLabel ? `\n${t("bookmarked", { time: timeLabel })}` : ""}`}
    >
      <span className="grid-card-check">{isSelected ? "◉" : "○"}</span>
      <img
        className="grid-card-favicon"
        src={safeFaviconUrl(bm.url)}
        alt=""
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span className="grid-card-title">{bm.title || t("untitled")}</span>
      {status === "checking" && <span className="grid-card-status status-checking">{t("link_checking")}</span>}
      {status === "valid" && <span className="grid-card-status status-valid" title={t("link_valid")}>✓</span>}
      {status === "broken" && <span className="grid-card-status status-broken" title={t("link_broken")}>✗</span>}
      {timeLabel && <span className="grid-card-time">{timeLabel}</span>}
      {bm.url && (
        <button className="grid-card-visit" onClick={handleVisit} title={bm.url}>↗</button>
      )}
    </div>
  );
}
