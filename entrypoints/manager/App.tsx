import React, { useState, useRef, useCallback, useMemo } from "react";
import { useBookmarks } from "../../src/hooks/useBookmarks";
import { useLinkCheck } from "../../src/hooks/useLinkCheck";
import Header from "../../src/components/Header";
import FolderTree from "../../src/components/FolderTree";
import BookmarkList from "../../src/components/BookmarkList";
import ToolBar from "../../src/components/ToolBar";
import GridView from "../../src/components/GridView";
import ContextMenu from "../../src/components/ContextMenu";
import Toast from "../../src/components/Toast";
import { logger } from "../../src/lib/logger";
import { useI18n } from "../../src/lib/i18n";
import type { BookmarkNode, ContextMenuState, SavedTreeNode } from "../../src/lib/types";

const EXT_VERSION = chrome.runtime.getManifest().version;

export default function App() {
  const { t } = useI18n();
  const {
    tree,
    flatFolders,
    selectedFolder,
    selectFolder,
    selectedBookmarkIds,
    toggleBookmark,
    toggleSelectAll,
    deleteSelected,
    moveBookmark,
    createFolder,
    refresh,
    searchQuery,
    setSearchQuery,
    filteredBookmarks,
    bookmarkCount,
    emptyFolders,
    duplicateBookmarks,
  } = useBookmarks();

  // Log startup
  React.useEffect(() => {
    logger.info(`Pinmark v${EXT_VERSION} initialized`);
  }, []);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("pinmark-dark") === "true");
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    linkStatus,
    isChecking: isCheckingLinks,
    brokenCount,
    lastCheckedAt,
    checkLinks,
    recheckBroken,
    getStatus,
  } = useLinkCheck();

  // Dark mode effect
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("pinmark-dark", String(darkMode));
  }, [darkMode]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in search
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        setContextMenu(null);
        return;
      }

      // ⌘F / Ctrl+F → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // ⌘A / Ctrl+A → select all (only in grid mode)
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        if (viewMode === "grid") {
          e.preventDefault();
          // Trigger select all via the grid view
          window.dispatchEvent(new CustomEvent("grid-select-all"));
        }
        return;
      }

      // Delete / Backspace → delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        if (viewMode === "grid") {
          window.dispatchEvent(new CustomEvent("grid-delete-selected"));
        } else if (selectedBookmarkIds.size > 0) {
          if (confirm(t("delete_confirm", { count: selectedBookmarkIds.size }))) {
            deleteSelected();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, selectedBookmarkIds, deleteSelected]);

  // Toast auto-dismiss
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message: string, onUndo?: () => void) => {
    setToast({ message, onUndo });
  };

  // Save folder tree structure for undo
  const saveFolderTree = useCallback((node: chrome.bookmarks.BookmarkTreeNode): SavedTreeNode => ({
    parentId: node.parentId,
    title: node.title,
    url: node.url,
    index: node.index,
    children: node.children?.map((c) => saveFolderTree(c)),
  }), []);

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
          // Restore recursively — first the root, then children inside it
          const restore = async (data: any, parentId?: string): Promise<string> => {
            const created = await chrome.bookmarks.create({
              parentId: parentId || "1",
              title: data.title,
              url: data.url,
              index: data.index,
            });
            if (data.children) {
              for (const child of data.children) {
                await restore(child, created.id);
              }
            }
            return created.id;
          };
          await restore(saved);
          await refresh();
        }
      );
    } catch {
      showToast(t("delete_folder_failed"));
    }
  }, [saveFolderTree, refresh]);

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

  const currentBookmarks = useMemo(
    () => selectedFolder
      ? filteredBookmarks.filter((n) => n.parentId === selectedFolder)
      : [],
    [selectedFolder, filteredBookmarks]
  );

  // Check links for current view
  const handleCheckLinks = useCallback(() => {
    const bookmarksWithUrls = viewMode === "grid"
      ? filteredBookmarks.filter((b) => b.url).map((b) => ({ id: b.id, url: b.url! }))
      : currentBookmarks.filter((b) => b.url).map((b) => ({ id: b.id, url: b.url! }));
    if (bookmarksWithUrls.length === 0) return;
    checkLinks(bookmarksWithUrls);
    showToast(t("checking_links", { count: bookmarksWithUrls.length }));
  }, [viewMode, filteredBookmarks, currentBookmarks, checkLinks]);

  // Re-check only broken links
  const handleRecheckBroken = useCallback(() => {
    const bookmarksWithUrls = viewMode === "grid"
      ? filteredBookmarks.filter((b) => b.url).map((b) => ({ id: b.id, url: b.url! }))
      : currentBookmarks.filter((b) => b.url).map((b) => ({ id: b.id, url: b.url! }));
    recheckBroken(bookmarksWithUrls);
  }, [viewMode, filteredBookmarks, currentBookmarks, recheckBroken]);

  // Wrap delete to support undo
  const deleteWithUndo = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      if (!confirm(t("delete_confirm", { count: ids.length }))) return;
      const saved: { id: string; node: chrome.bookmarks.BookmarkTreeNode }[] = [];
      for (const id of ids) {
        try {
          const [node] = await chrome.bookmarks.get(id);
          saved.push({ id, node });
          await chrome.bookmarks.remove(id);
        } catch {
          try {
            const [node] = await chrome.bookmarks.getSubTree(id);
            saved.push({ id, node });
            await chrome.bookmarks.removeTree(id);
          } catch {
            // skip
          }
        }
      }
      await refresh();
      showToast(
        t("deleted_bookmarks", { count: saved.length }),
        () => {
          // Undo: re-create each
          Promise.all(
            saved.map(({ node }) =>
              chrome.bookmarks.create({
                parentId: node.parentId || "1",
                title: node.title,
                url: node.url,
                index: node.index,
              })
            )
          ).then(() => refresh());
        }
      );
    },
    [refresh]
  );

  const handleFolderContextMenu = (e: React.MouseEvent, node: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.id === "0" || node.id === "1") return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "folder",
      node,
    });
  };

  const handleBookmarkContextMenu = (e: React.MouseEvent, node: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "bookmark",
      node,
    });
  };

  const handleContextMenuAction = async (action: string) => {
    if (!contextMenu) return;
    const node = contextMenu.node!;

    if (action === "create-sub-folder") {
      createFolder(node.id);
      setContextMenu(null);
      return;
    }
    if (action === "rename-folder") {
      handleRenameNode(node.id, node.title);
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
    if (action === "delete-folder") {
      await handleDeleteFolderWithUndo(node.id, node.title);
    }
    if (action === "delete-bookmark") {
      if (!confirm(t("delete_confirm", { count: 1 }))) return;
      await chrome.bookmarks.remove(node.id);
      await refresh();
      showToast(t("deleted_bookmark_item", { title: node.title }));
    }
    if (action === "open-all") {
      // Open all bookmarks in the folder
      const urls: string[] = [];
      const collect = (nodes: BookmarkNode[]) => {
        for (const n of nodes) {
          if (n.url) urls.push(n.url);
          if (n.children) collect(n.children);
        }
      };
      collect(node.children || []);
      for (const url of urls) {
        chrome.tabs.create({ url });
      }
      showToast(t("opened_bookmarks", { count: urls.length }));
    }
    setContextMenu(null);
  };

  React.useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const handleGridFolderSelect = (id: string) => {
    selectFolder(id);
    const el = document.querySelector(`[data-folder-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleGridDropBookmarks = async (ids: string[], destinationFolderId: string) => {
    for (const id of ids) {
      await moveBookmark(id, destinationFolderId);
    }
  };

  const currentFolderTitle = useMemo(
    () => selectedFolder && flatFolders.find((f) => f.node.id === selectedFolder)?.node.title,
    [selectedFolder, flatFolders]
  );

  return (
    <div className={`app view-${viewMode}`}>
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        bookmarkCount={bookmarkCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        searchRef={searchRef}
      />

      {viewMode === "grid" ? (
        <div className="main-layout">
          <aside className="folder-panel">
            <FolderTree
              tree={tree}
              selectedFolder={selectedFolder}
              onSelect={handleGridFolderSelect}
              onContextMenu={handleFolderContextMenu}
              onDropBookmarks={handleGridDropBookmarks}
            />
            <button
              className="btn-new-folder"
              onClick={() => createFolder(selectedFolder || "1")}
            >
              {t("new_folder")}
            </button>
          </aside>
          <main className="grid-layout">
            <GridView
              tree={tree}
              searchQuery={searchQuery}
              onMove={moveBookmark}
              onDeleteSelected={deleteWithUndo}
              onDeleteFolder={handleDeleteFolderWithUndo}
              onCreateSubFolder={createFolder}
              onContextMenu={handleBookmarkContextMenu}
              onRename={handleRenameNode}
              onCheckLinks={handleCheckLinks}
              onRecheckBroken={handleRecheckBroken}
              isCheckingLinks={isCheckingLinks}
              brokenCount={brokenCount}
              lastCheckedAt={lastCheckedAt}
              getLinkStatus={getStatus}
            />
          </main>
        </div>
      ) : (
        <div className="main-layout">
          <aside className="folder-panel">
            <FolderTree
              tree={tree}
              selectedFolder={selectedFolder}
              onSelect={selectFolder}
              onContextMenu={handleFolderContextMenu}
              onDropBookmarks={handleGridDropBookmarks}
            />
            <button
              className="btn-new-folder"
              onClick={() => createFolder(selectedFolder || "1")}
            >
              {t("new_folder")}
            </button>
          </aside>
          <main className="bookmark-panel">
            {selectedFolder ? (
              <>
                <ToolBar
                  folderTitle={currentFolderTitle || ""}
                  bookmarkCount={currentBookmarks.length}
                  selectedCount={selectedBookmarkIds.size}
                  allSelected={
                    currentBookmarks.length > 0 &&
                    currentBookmarks.every((b) => selectedBookmarkIds.has(b.id))
                  }
                  onToggleSelectAll={() =>
                    toggleSelectAll(
                      currentBookmarks.map((b) => b.id),
                      currentBookmarks.every((b) => selectedBookmarkIds.has(b.id))
                    )
                  }
                  onDeleteSelected={() => {
                    if (confirm(t("delete_confirm", { count: selectedBookmarkIds.size }))) {
                      deleteSelected();
                    }
                  }}
                  onCheckLinks={handleCheckLinks}
                  onRecheckBroken={handleRecheckBroken}
                  isCheckingLinks={isCheckingLinks}
                  brokenCount={brokenCount}
                  lastCheckedAt={lastCheckedAt}
                  emptyFolders={emptyFolders}
                  duplicateBookmarks={duplicateBookmarks}
                />
                <BookmarkList
                  bookmarks={currentBookmarks}
                  selectedIds={selectedBookmarkIds}
                  onToggle={toggleBookmark}
                  onMove={moveBookmark}
                  onContextMenu={handleBookmarkContextMenu}
                  getLinkStatus={getStatus}
                />
              </>
            ) : (
              <div className="empty-state">
                <p>{t("select_folder_hint")}</p>
              </div>
            )}
          </main>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          onAction={handleContextMenuAction}
        />
      )}

      {toast && <Toast message={toast.message} onUndo={toast.onUndo} onClose={() => setToast(null)} />}

      <span className="version-badge" title={`Pinmark v${EXT_VERSION}`}>v{EXT_VERSION}</span>
    </div>
  );
}
