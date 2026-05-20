import type { BookmarkNode } from "./types";

export function flattenTree(
  nodes: BookmarkNode[],
  depth = 0
): { node: BookmarkNode; depth: number }[] {
  const result: { node: BookmarkNode; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.children) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

export function collectFolderIds(nodes: BookmarkNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children) {
      ids.push(node.id);
      ids.push(...collectFolderIds(node.children));
    }
  }
  return ids;
}

export function findEmptyFolders(
  nodes: BookmarkNode[]
): { id: string; title: string; parentId?: string }[] {
  const empty: { id: string; title: string; parentId?: string }[] = [];
  for (const node of nodes) {
    if (node.children) {
      if (node.children.length === 0) {
        empty.push({ id: node.id, title: node.title, parentId: node.parentId });
      } else {
        empty.push(...findEmptyFolders(node.children));
      }
    }
  }
  return empty;
}

export function findDuplicateBookmarks(
  nodes: BookmarkNode[]
): { id: string; title: string; url: string; parentId?: string }[] {
  const seen = new Map<string, string[]>();
  const all: { id: string; title: string; url: string; parentId?: string }[] = [];
  const duplicates: { id: string; title: string; url: string; parentId?: string }[] = [];

  function walk(list: BookmarkNode[]) {
    for (const n of list) {
      if (n.url) {
        all.push({ id: n.id, title: n.title, url: n.url, parentId: n.parentId });
        if (seen.has(n.url)) {
          seen.get(n.url)!.push(n.id);
        } else {
          seen.set(n.url, [n.id]);
        }
      }
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);

  for (const [url, ids] of seen) {
    if (ids.length > 1) {
      // keep the first one, mark rest as duplicates
      for (let i = 1; i < ids.length; i++) {
        const bm = all.find((b) => b.id === ids[i]);
        if (bm) duplicates.push(bm);
      }
    }
  }
  return duplicates;
}

export async function loadBookmarkTree(): Promise<BookmarkNode[]> {
  const [root] = await chrome.bookmarks.getTree();
  // root.children[0] is the bookmark bar, children[1] is other bookmarks
  return root.children || [];
}

export async function moveBookmarkNode(id: string, parentId: string) {
  await chrome.bookmarks.move(id, { parentId });
}

export async function removeBookmarkTree(id: string) {
  await chrome.bookmarks.removeTree(id);
}

export async function createBookmarkFolder(
  parentId: string,
  title: string
): Promise<BookmarkNode> {
  return chrome.bookmarks.create({ parentId, title });
}
