import { useState, useEffect, useCallback, useMemo } from "react";
import type { BookmarkNode } from "../lib/types";
import { useI18n } from "../lib/i18n";
import {
  loadBookmarkTree,
  flattenTree,
  collectFolderIds,
  findEmptyFolders,
  findDuplicateBookmarks,
  moveBookmarkNode,
  removeBookmarkTree,
  createBookmarkFolder,
} from "../lib/bookmark-utils";

export function useBookmarks() {
  const { t } = useI18n();
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    const treeData = await loadBookmarkTree();
    setTree(treeData);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // auto-select first folder (bookmark bar = tree[0])
  useEffect(() => {
    if (!selectedFolder && tree.length > 0) {
      setSelectedFolder(tree[0]?.id || null);
    }
  }, [tree, selectedFolder]);

  const flatFolders = useMemo(
    () => flattenTree(tree).filter(({ node }) => node.children),
    [tree]
  );

  const allBookmarks = useMemo(
    () => flattenTree(tree)
      .filter(({ node }) => !!node.url)
      .map(({ node }) => node),
    [tree]
  );

  const bookmarkCount = allBookmarks.length;

  const filteredBookmarks = useMemo(
    () => searchQuery
      ? allBookmarks.filter(
          (n) =>
            n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.url!.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allBookmarks,
    [allBookmarks, searchQuery]
  );

  const selectFolder = useCallback((id: string) => {
    setSelectedFolder(id);
    setSelectedBookmarkIds(new Set());
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setSelectedBookmarkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (ids: string[], currentlyAllSelected: boolean) => {
      if (currentlyAllSelected) {
        setSelectedBookmarkIds(new Set());
      } else {
        setSelectedBookmarkIds(new Set(ids));
      }
    },
    []
  );

  const deleteSelected = useCallback(async () => {
    for (const id of selectedBookmarkIds) {
      try {
        await chrome.bookmarks.remove(id);
      } catch {
        // might be a folder with children
        try {
          await chrome.bookmarks.removeTree(id);
        } catch {
          // skip
        }
      }
    }
    setSelectedBookmarkIds(new Set());
    await refresh();
  }, [selectedBookmarkIds, refresh]);

  const moveBookmark = useCallback(
    async (id: string, destinationParentId: string) => {
      await moveBookmarkNode(id, destinationParentId);
      await refresh();
    },
    [refresh]
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        await removeBookmarkTree(id);
        setSelectedFolder(null);
        await refresh();
      } catch {
        // Folder deletion failed (e.g., already removed, API error)
      }
    },
    [refresh]
  );

  const createFolder = useCallback(
    async (parentId: string) => {
      const name = prompt(t("folder_name_prompt"));
      if (!name) return;
      await createBookmarkFolder(parentId, name);
      await refresh();
    },
    [refresh]
  );

  const emptyFolders = useMemo(() => findEmptyFolders(tree), [tree]);
  const duplicateBookmarks = useMemo(() => findDuplicateBookmarks(tree), [tree]);

  return {
    tree,
    flatFolders,
    selectedFolder,
    selectFolder,
    selectedBookmarkIds,
    toggleBookmark,
    toggleSelectAll,
    deleteSelected,
    moveBookmark,
    deleteFolder,
    createFolder,
    searchQuery,
    setSearchQuery,
    filteredBookmarks,
    bookmarkCount,
    emptyFolders,
    duplicateBookmarks,
    refresh,
  };
}
