import { useState, useEffect, useCallback } from "react";
import type { BookmarkNode } from "../lib/types";
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
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    const t = await loadBookmarkTree();
    setTree(t);
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

  const flatFolders = tree.length > 0 ? flattenTree(tree).filter(({ node }) => node.children) : [];

  const allBookmarks = tree.length > 0
    ? flattenTree(tree)
        .filter(({ node }) => !!node.url)
        .map(({ node }) => node)
    : [];

  const bookmarkCount = allBookmarks.length;

  const filteredBookmarks = searchQuery
    ? allBookmarks.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (n.url || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allBookmarks;

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
      await removeBookmarkTree(id);
      setSelectedFolder(null);
      await refresh();
    },
    [refresh]
  );

  const createFolder = useCallback(
    async (parentId: string) => {
      const name = prompt("文件夹名称：");
      if (!name) return;
      await createBookmarkFolder(parentId, name);
      await refresh();
    },
    [refresh]
  );

  const emptyFolders = tree.length > 0 ? findEmptyFolders(tree) : [];
  const duplicateBookmarks = tree.length > 0 ? findDuplicateBookmarks(tree) : [];

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
  };
}
