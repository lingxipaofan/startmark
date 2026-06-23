import { describe, it, expect } from "vitest";
import {
  flattenTree,
  collectFolderIds,
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
