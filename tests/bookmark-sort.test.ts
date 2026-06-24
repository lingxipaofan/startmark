import { describe, expect, it } from "vitest";
import { sortBookmarkNodes } from "../src/lib/bookmark-sort";
import type { BookmarkNode } from "../src/lib/types";

const nodes: BookmarkNode[] = [
  { id: "1", title: "Beta 10", dateAdded: 30 },
  { id: "2", title: "alpha", dateAdded: 10 },
  { id: "3", title: "Beta 2", dateAdded: 20 },
];

describe("sortBookmarkNodes", () => {
  it("preserves Chrome order in folder/default mode", () => {
    expect(sortBookmarkNodes(nodes, "folder", "asc")).toBe(nodes);
  });

  it("sorts names naturally in both directions", () => {
    expect(sortBookmarkNodes(nodes, "alphabetical", "asc").map((node) => node.id))
      .toEqual(["2", "3", "1"]);
    expect(sortBookmarkNodes(nodes, "alphabetical", "desc").map((node) => node.id))
      .toEqual(["1", "3", "2"]);
  });

  it("sorts by creation time without mutating the source", () => {
    expect(sortBookmarkNodes(nodes, "time", "asc").map((node) => node.id))
      .toEqual(["2", "3", "1"]);
    expect(nodes.map((node) => node.id)).toEqual(["1", "2", "3"]);
  });
});
