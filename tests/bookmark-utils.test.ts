import { describe, it, expect } from "vitest";
import {
  flattenTree,
  collectFolderIds,
  findEmptyFolders,
  findDuplicateBookmarks,
} from "../src/lib/bookmark-utils";
import type { BookmarkNode } from "../src/lib/types";

describe("flattenTree", () => {
  it("returns empty array for empty input", () => {
    expect(flattenTree([])).toEqual([]);
  });

  it("flattens a single node without children", () => {
    const nodes: BookmarkNode[] = [{ id: "1", title: "root" }];
    expect(flattenTree(nodes)).toEqual([{ node: nodes[0], depth: 0 }]);
  });

  it("flattens nested structure with correct depths", () => {
    const nodes: BookmarkNode[] = [
      {
        id: "1",
        title: "folder",
        children: [
          { id: "2", title: "child", url: "https://example.com" },
          {
            id: "3",
            title: "subfolder",
            children: [{ id: "4", title: "grandchild", url: "https://example.com/2" }],
          },
        ],
      },
    ];
    const result = flattenTree(nodes);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ node: nodes[0], depth: 0 });
    expect(result[1]).toEqual({ node: nodes[0].children![0], depth: 1 });
    expect(result[2]).toEqual({ node: nodes[0].children![1], depth: 1 });
    expect(result[3]).toEqual({ node: nodes[0].children![1].children![0], depth: 2 });
  });

  it("handles multiple root nodes", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "a", children: [{ id: "2", title: "a1", url: "https://a.com" }] },
      { id: "3", title: "b" },
    ];
    const result = flattenTree(nodes);
    expect(result).toHaveLength(3);
  });
});

describe("collectFolderIds", () => {
  it("returns empty for empty input", () => {
    expect(collectFolderIds([])).toEqual([]);
  });

  it("returns folder ids only (no leaf bookmarks)", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "folder", children: [] },
      { id: "2", title: "bm", url: "https://x.com" },
    ];
    expect(collectFolderIds(nodes)).toEqual(["1"]);
  });

  it("recursively collects nested folder ids", () => {
    const nodes: BookmarkNode[] = [
      {
        id: "1",
        title: "a",
        children: [
          { id: "2", title: "b", children: [{ id: "3", title: "c", children: [] }] },
        ],
      },
    ];
    expect(collectFolderIds(nodes)).toEqual(["1", "2", "3"]);
  });
});

describe("findEmptyFolders", () => {
  it("returns empty when no empty folders", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "f", children: [{ id: "2", title: "bm", url: "https://x.com" }] },
    ];
    expect(findEmptyFolders(nodes)).toEqual([]);
  });

  it("finds empty folders at root level", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "empty", children: [] },
      { id: "2", title: "full", children: [{ id: "3", title: "bm", url: "https://x.com" }] },
    ];
    expect(findEmptyFolders(nodes)).toEqual([{ id: "1", title: "empty", parentId: undefined }]);
  });

  it("finds nested empty folders", () => {
    const nodes: BookmarkNode[] = [
      {
        id: "1",
        title: "parent",
        children: [
          { id: "2", title: "empty-child", children: [] },
          { id: "3", title: "non-empty", children: [{ id: "4", title: "bm", url: "https://x.com" }] },
        ],
      },
    ];
    expect(findEmptyFolders(nodes)).toEqual([
      { id: "2", title: "empty-child", parentId: undefined },
    ]);
  });

  it("returns empty for input with no folders", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "a", url: "https://a.com" },
      { id: "2", title: "b", url: "https://b.com" },
    ];
    expect(findEmptyFolders(nodes)).toEqual([]);
  });
});

describe("findDuplicateBookmarks", () => {
  it("returns empty when no duplicates", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "a", url: "https://a.com" },
      { id: "2", title: "b", url: "https://b.com" },
    ];
    expect(findDuplicateBookmarks(nodes)).toEqual([]);
  });

  it("finds duplicate URLs, keeping the first occurrence", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "first", url: "https://example.com" },
      { id: "2", title: "second", url: "https://example.com" },
      { id: "3", title: "third", url: "https://other.com" },
    ];
    const result = findDuplicateBookmarks(nodes);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "2", title: "second", url: "https://example.com" });
  });

  it("finds duplicates within nested folders", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "a", url: "https://dup.com" },
      {
        id: "2",
        title: "folder",
        children: [{ id: "3", title: "b", url: "https://dup.com" }],
      },
    ];
    const result = findDuplicateBookmarks(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("handles items without URLs (folders)", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "folder", children: [{ id: "2", title: "bm", url: "https://example.com" }] },
    ];
    expect(findDuplicateBookmarks(nodes)).toEqual([]);
  });

  it("marks multiple duplicates beyond the first", () => {
    const nodes: BookmarkNode[] = [
      { id: "1", title: "a", url: "https://same.com" },
      { id: "2", title: "b", url: "https://same.com" },
      { id: "3", title: "c", url: "https://same.com" },
    ];
    const result = findDuplicateBookmarks(nodes);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("2");
    expect(result[1].id).toBe("3");
  });
});
