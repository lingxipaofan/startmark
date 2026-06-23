import React, { useState, useEffect, useRef, useMemo } from "react";
import { ArrowUpDown, Check, Link2, LoaderCircle } from "lucide-react";
import type { BookmarkNode, LinkStatus } from "../lib/types";
import { useI18n, formatRelativeTime, timeBucket } from "../lib/i18n";
import {
  sortBookmarkNodes,
  type AlphabeticalDirection,
  type SortMode,
} from "../lib/bookmark-sort";
import { simplifyBookmarkTitle } from "../lib/bookmark-title";

interface Props {
  tree: BookmarkNode[];
  searchQuery: string;
  onMove: (id: string, destinationFolderId: string) => void;
  onDeleteFolder?: (folderId: string, folderTitle: string) => void;
  onCreateSubFolder?: (parentId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onRename?: (id: string, currentTitle: string) => void;
  onCheckLinks?: () => void;
  isCheckingLinks?: boolean;
  brokenCount?: number;
  getLinkStatus?: (id: string) => LinkStatus;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  alphabeticalDirection: AlphabeticalDirection;
  onAlphabeticalDirectionChange: (direction: AlphabeticalDirection) => void;
  simplifyTitles: boolean;
}

interface FolderSection {
  folder: BookmarkNode;
  bookmarks: BookmarkNode[];
  breadcrumb: string[]; // ancestor titles, e.g. ["书签栏", "工作"]
}

export default function GridView({
  tree,
  searchQuery,
  onMove,
  onDeleteFolder,
  onCreateSubFolder,
  onContextMenu,
  onRename,
  onCheckLinks,
  isCheckingLinks,
  brokenCount,
  getLinkStatus,
  sortMode,
  onSortModeChange,
  alphabeticalDirection,
  onAlphabeticalDirectionChange,
  simplifyTitles,
}: Props) {
  const { t } = useI18n();
  const [sections, setSections] = useState<FolderSection[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const dragData = useRef<string[] | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
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
    setSections(result);
  }, [tree]);

  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [showSortMenu]);

  useEffect(() => {
    if (!folderMenu) return;
    const close = () => setFolderMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [folderMenu]);

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

  const displayedFolderSections = useMemo(() => {
    if (sortMode !== "alphabetical") return filteredSections;
    const rootSections = filteredSections.filter((section) => section.folder.parentId === "0");
    const regularSections = filteredSections.filter((section) => section.folder.parentId !== "0");
    const sortedFolders = sortBookmarkNodes(
      regularSections.map((section) => section.folder),
      sortMode,
      alphabeticalDirection
    );
    return [...rootSections.map((section) => section.folder), ...sortedFolders].map((folder) => {
      const section = filteredSections.find((item) => item.folder.id === folder.id)!;
      return {
        ...section,
        bookmarks: sortBookmarkNodes(section.bookmarks, sortMode, alphabeticalDirection),
      };
    });
  }, [filteredSections, sortMode, alphabeticalDirection]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardClick = (bm: BookmarkNode) => {
    if (bm.url) chrome.tabs.update({ url: bm.url });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    const ids = [id];
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

  const hasItems = sortMode !== "time" ? displayedFolderSections.length > 0 : timeGroups.length > 0;

  if (!hasItems) {
    return (
      <div className="grid-view-empty">
        <p>{searchQuery ? t("no_matching") : t("no_bookmarks")}</p>
      </div>
    );
  }

  return (
    <div className="grid-view">
      <div className="floating-tool floating-tool-left" ref={sortMenuRef}>
        <button
          type="button"
          className={`floating-tool-button ${showSortMenu ? "active" : ""}`}
          onClick={() => setShowSortMenu((open) => !open)}
          aria-label={t("sort_options")}
          aria-haspopup="menu"
          aria-expanded={showSortMenu}
          title={t("sort_options")}
        >
          <ArrowUpDown size={17} aria-hidden="true" />
        </button>
        {showSortMenu && (
          <div className="sort-popover" role="menu">
            <button
              type="button"
              className={sortMode === "folder" ? "active" : ""}
              onClick={() => {
                onSortModeChange("folder");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "folder" && <Check size={14} />}</span>
              {t("sort_custom")}
            </button>
            <button
              type="button"
              className={sortMode === "alphabetical" && alphabeticalDirection === "asc" ? "active" : ""}
              onClick={() => {
                onAlphabeticalDirectionChange("asc");
                onSortModeChange("alphabetical");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "alphabetical" && alphabeticalDirection === "asc" && <Check size={14} />}</span>
              {t("sort_name_asc")}
            </button>
            <button
              type="button"
              className={sortMode === "alphabetical" && alphabeticalDirection === "desc" ? "active" : ""}
              onClick={() => {
                onAlphabeticalDirectionChange("desc");
                onSortModeChange("alphabetical");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "alphabetical" && alphabeticalDirection === "desc" && <Check size={14} />}</span>
              {t("sort_name_desc")}
            </button>
            <button
              type="button"
              className={sortMode === "time" ? "active" : ""}
              onClick={() => {
                onSortModeChange("time");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "time" && <Check size={14} />}</span>
              {t("sort_by_time")}
            </button>
          </div>
        )}
      </div>

      <div className="floating-tool floating-tool-right">
        <button
          type="button"
          className="floating-tool-button"
          onClick={onCheckLinks}
          disabled={isCheckingLinks || !onCheckLinks}
          aria-label={t("check_links")}
          title={brokenCount ? t("broken_found", { count: brokenCount }) : t("check_links")}
        >
          {isCheckingLinks
            ? <LoaderCircle className="floating-tool-spinner" size={17} aria-hidden="true" />
            : <Link2 size={17} aria-hidden="true" />}
          {!!brokenCount && !isCheckingLinks && (
            <span className="floating-tool-badge" aria-hidden="true">{brokenCount > 99 ? "99+" : brokenCount}</span>
          )}
        </button>
      </div>

      {/* Folder mode — each folder = one column */}
      {sortMode !== "time" &&
        displayedFolderSections.map((section) => (
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
              <span className="grid-section-count">· {section.bookmarks.length}</span>
            </div>
            {!collapsedSections.has(section.folder.id) && (
              <div className="grid-section-body">
                {section.bookmarks.map((bm) => (
                  <BookmarkCard
                    key={bm.id}
                    bm={bm}
                    onDragStart={handleDragStart}
                    onClick={handleCardClick}
                    onContextMenu={onContextMenu}
                    linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
                    simplifyTitle={simplifyTitles}
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
              <span className="grid-section-count">· {group.bookmarks.length}</span>
            </div>
            <div className="grid-section-body">
              {group.bookmarks.map((bm) => (
                <BookmarkCard
                  key={bm.id}
                  bm={bm}
                  timeLabel={formatRelativeTime(bm.dateAdded || 0, t)}
                  onDragStart={handleDragStart}
                  onClick={handleCardClick}
                  onContextMenu={onContextMenu}
                  linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
                  simplifyTitle={simplifyTitles}
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
  timeLabel,
  onDragStart,
  onClick,
  onContextMenu,
  linkStatus: status,
  simplifyTitle,
}: {
  bm: BookmarkNode;
  timeLabel?: string;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: (bm: BookmarkNode) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  linkStatus?: LinkStatus;
  simplifyTitle: boolean;
}) {
  const { t } = useI18n();

  return (
    <div
      className={`grid-card ${status !== "unknown" ? `link-${status}` : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, bm.id)}
      onClick={() => onClick(bm)}
      onContextMenu={(e) => onContextMenu(e, bm)}
      title={`${bm.title}\n${bm.url}${timeLabel ? `\n${t("bookmarked", { time: timeLabel })}` : ""}`}
    >
      <img
        className="grid-card-favicon"
        src={safeFaviconUrl(bm.url)}
        alt=""
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span className="grid-card-title">
        {simplifyTitle
          ? simplifyBookmarkTitle(bm.title || t("untitled"))
          : bm.title || t("untitled")}
      </span>
      {status === "checking" && <span className="grid-card-status status-checking">{t("link_checking")}</span>}
      {status === "valid" && <span className="grid-card-status status-valid" title={t("link_valid")}>✓</span>}
      {status === "broken" && <span className="grid-card-status status-broken" title={t("link_broken")}>✗</span>}
      {timeLabel && <span className="grid-card-time">{timeLabel}</span>}
    </div>
  );
}
