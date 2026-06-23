import React, { useState, useRef, useCallback, useMemo } from "react";
import { useBookmarks } from "../../src/hooks/useBookmarks";
import { useLinkCheck } from "../../src/hooks/useLinkCheck";
import Header from "../../src/components/Header";
import GridView from "../../src/components/GridView";
import ContextMenu from "../../src/components/ContextMenu";
import Toast from "../../src/components/Toast";
import { logger } from "../../src/lib/logger";
import { useI18n } from "../../src/lib/i18n";
import type { BookmarkNode, ContextMenuState, SavedTreeNode } from "../../src/lib/types";
import {
  ALPHABETICAL_DIRECTION_KEY,
  SORT_MODE_KEY,
  readAlphabeticalDirection,
  readSortMode,
  type AlphabeticalDirection,
  type SortMode,
} from "../../src/lib/bookmark-sort";

const EXT_VERSION = chrome.runtime.getManifest().version;
const SIMPLIFY_TITLES_KEY = "pinmark-simplify-titles";

export default function App() {
  const { t } = useI18n();
  const {
    tree,
    moveBookmark,
    createFolder,
    refresh,
    searchQuery,
    setSearchQuery,
    filteredBookmarks,
    bookmarkCount,
  } = useBookmarks();

  // Log startup
  React.useEffect(() => {
    logger.info(`Pinmark v${EXT_VERSION} initialized`);
  }, []);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("pinmark-dark") === "true");
  const [sortMode, setSortMode] = useState<SortMode>(readSortMode);
  const [alphabeticalDirection, setAlphabeticalDirection] =
    useState<AlphabeticalDirection>(readAlphabeticalDirection);
  const [simplifyTitles, setSimplifyTitles] = useState(
    () => localStorage.getItem(SIMPLIFY_TITLES_KEY) === "true"
  );
  const [toast, setToast] = useState<{
    message: string;
    onUndo?: () => void | Promise<void>;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    isChecking: isCheckingLinks,
    checkLinks,
    pruneLinkStatus,
    getStatus,
  } = useLinkCheck();

  // Dark mode effect
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("pinmark-dark", String(darkMode));
  }, [darkMode]);

  React.useEffect(() => {
    localStorage.setItem(SORT_MODE_KEY, sortMode);
  }, [sortMode]);

  React.useEffect(() => {
    localStorage.setItem(ALPHABETICAL_DIRECTION_KEY, alphabeticalDirection);
  }, [alphabeticalDirection]);

  React.useEffect(() => {
    localStorage.setItem(SIMPLIFY_TITLES_KEY, String(simplifyTitles));
  }, [simplifyTitles]);

  // Toast auto-dismiss
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    pruneLinkStatus(filteredBookmarks.map((bookmark) => bookmark.id));
  }, [filteredBookmarks, pruneLinkStatus]);

  const showToast = useCallback((message: string, onUndo?: () => void | Promise<void>) => {
    setToast({ message, onUndo });
  }, []);

  // Save folder tree structure for undo
  const saveFolderTree = useCallback((node: chrome.bookmarks.BookmarkTreeNode): SavedTreeNode => ({
    parentId: node.parentId,
    title: node.title,
    url: node.url,
    index: node.index,
    children: node.children?.map((c) => saveFolderTree(c)),
  }), []);

  const restoreBookmarkTree = useCallback(async (
    data: SavedTreeNode,
    parentId = data.parentId || "1"
  ): Promise<string> => {
    const created = await chrome.bookmarks.create({
      parentId,
      title: data.title,
      url: data.url,
      index: data.index,
    });
    for (const child of data.children || []) {
      await restoreBookmarkTree(child, created.id);
    }
    return created.id;
  }, []);

  // Delete a folder with undo support
  const handleDeleteFolderWithUndo = useCallback(async (folderId: string, folderTitle: string) => {
    try {
      const [node] = await chrome.bookmarks.getSubTree(folderId);
      const saved = saveFolderTree(node);
      await chrome.bookmarks.removeTree(folderId);
      await refresh();
      showToast(
        t("deleted_folder", { title: folderTitle }),
        async () => {
          try {
            await restoreBookmarkTree(saved);
            await refresh();
          } catch (error) {
            showToast(t("undo_failed"));
            throw error;
          }
        }
      );
    } catch {
      showToast(t("delete_folder_failed"));
    }
  }, [saveFolderTree, restoreBookmarkTree, refresh, showToast, t]);

  // Rename a bookmark or folder
  const handleRenameNode = useCallback(async (id: string, currentTitle: string) => {
    const name = prompt(t("rename_prompt"), currentTitle);
    if (!name || name === currentTitle) return;
    try {
      await chrome.bookmarks.update(id, { title: name });
      await refresh();
    } catch {
      showToast(t("rename_failed"));
    }
  }, [refresh]);

  // Edit a bookmark's URL
  const handleEditUrl = useCallback(async (id: string, currentUrl: string) => {
    const url = prompt(t("url_prompt"), currentUrl);
    if (!url || url === currentUrl) return;
    try {
      await chrome.bookmarks.update(id, { url });
      await refresh();
    } catch {
      showToast(t("edit_url_failed"));
    }
  }, [refresh]);

  const visibleBrokenCount = useMemo(
    () => filteredBookmarks.filter((bookmark) => getStatus(bookmark.id) === "broken").length,
    [filteredBookmarks, getStatus]
  );

  // Check links for current view
  const handleCheckLinks = useCallback(() => {
    const bookmarksWithUrls = filteredBookmarks
      .filter((b) => b.url)
      .map((b) => ({ id: b.id, url: b.url! }));
    if (bookmarksWithUrls.length === 0) return;
    checkLinks(bookmarksWithUrls);
    showToast(t("checking_links", { count: bookmarksWithUrls.length }));
  }, [filteredBookmarks, checkLinks, showToast, t]);

  const deleteBookmarkWithUndo = useCallback(
    async (id: string) => {
      if (!confirm(t("delete_confirm", { count: 1 }))) return;
      try {
        const [node] = await chrome.bookmarks.get(id);
        const saved = saveFolderTree(node);
        await chrome.bookmarks.remove(id);
        await refresh();
        showToast(
          t("deleted_bookmark_item", { title: node.title }),
          async () => {
            try {
              await restoreBookmarkTree(saved);
              await refresh();
            } catch (error) {
              showToast(t("undo_failed"));
              throw error;
            }
          }
        );
      } catch {
        // The bookmark may already have been removed by another Chrome window.
      }
    },
    [refresh, restoreBookmarkTree, saveFolderTree, showToast, t]
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        setContextMenu(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleBookmarkContextMenu = (e: React.MouseEvent, node: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const handleContextMenuAction = async (action: string) => {
    if (!contextMenu) return;
    const node = contextMenu.node!;

    if (action === "open-new-window") {
      if (node.url) await chrome.windows.create({ url: node.url });
      setContextMenu(null);
      return;
    }
    if (action === "rename-bookmark") {
      handleRenameNode(node.id, node.title);
      setContextMenu(null);
      return;
    }
    if (action === "edit-url") {
      handleEditUrl(node.id, node.url || "");
      setContextMenu(null);
      return;
    }
    if (action === "delete-bookmark") {
      await deleteBookmarkWithUndo(node.id);
    }
    setContextMenu(null);
  };

  React.useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <div className="app">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        bookmarkCount={bookmarkCount}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        simplifyTitles={simplifyTitles}
        onSimplifyTitlesChange={setSimplifyTitles}
        searchRef={searchRef}
      />

      <div className="main-layout">
        <main className="grid-layout">
          <GridView
            tree={tree}
            searchQuery={searchQuery}
            onMove={moveBookmark}
            onDeleteFolder={handleDeleteFolderWithUndo}
            onCreateSubFolder={createFolder}
            onContextMenu={handleBookmarkContextMenu}
            onRename={handleRenameNode}
            onCheckLinks={handleCheckLinks}
            isCheckingLinks={isCheckingLinks}
            brokenCount={visibleBrokenCount}
            getLinkStatus={getStatus}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            alphabeticalDirection={alphabeticalDirection}
            onAlphabeticalDirectionChange={setAlphabeticalDirection}
            simplifyTitles={simplifyTitles}
          />
        </main>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAction={handleContextMenuAction}
        />
      )}

      {toast && <Toast message={toast.message} onUndo={toast.onUndo} onClose={() => setToast(null)} />}

      <span className="version-badge" title={`Pinmark v${EXT_VERSION}`}>v{EXT_VERSION}</span>
    </div>
  );
}
