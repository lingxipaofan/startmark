import { useState, useEffect, useCallback, useMemo } from "react";
import type { BookmarkNode } from "../lib/types";
import { useI18n } from "../lib/i18n";
import {
  loadBookmarkTree,
  flattenTree,
  moveBookmarkNode,
  createBookmarkFolder,
} from "../lib/bookmark-utils";

export function useBookmarks() {
  const { t } = useI18n();
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    const treeData = await loadBookmarkTree();
    setTree(treeData);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const allBookmarks = useMemo(
    () => flattenTree(tree)
      .filter(({ node }) => !!node.url)
      .map(({ node }) => node),
    [tree]
  );

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

  const moveBookmark = useCallback(
    async (id: string, destinationParentId: string, index?: number) => {
      await moveBookmarkNode(id, destinationParentId, index);
      await refresh();
    },
    [refresh]
  );

  const createFolder = useCallback(
    async (parentId: string, providedName?: string) => {
      const name = providedName || prompt(t("folder_name_prompt"));
      if (!name) return;
      await createBookmarkFolder(parentId, name);
      await refresh();
    },
    [refresh]
  );

  return {
    tree,
    moveBookmark,
    createFolder,
    searchQuery,
    setSearchQuery,
    filteredBookmarks,
    refresh,
  };
}
