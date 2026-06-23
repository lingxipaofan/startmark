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

export async function loadBookmarkTree(): Promise<BookmarkNode[]> {
  const [root] = await chrome.bookmarks.getTree();
  // root.children[0] is the bookmark bar, children[1] is other bookmarks
  return root.children || [];
}

export async function moveBookmarkNode(id: string, parentId: string) {
  await chrome.bookmarks.move(id, { parentId });
}

export async function createBookmarkFolder(
  parentId: string,
  title: string
): Promise<BookmarkNode> {
  return chrome.bookmarks.create({ parentId, title });
}
