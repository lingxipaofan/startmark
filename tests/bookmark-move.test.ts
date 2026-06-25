import { describe, expect, it } from "vitest";
import { getRelativeMoveDestination } from "../src/lib/custom-order";
import type { BookmarkNode } from "../src/lib/types";

const node = (id: string, parentId: string, index: number): BookmarkNode => ({
  id,
  parentId,
  index,
  title: id,
});

describe("getRelativeMoveDestination", () => {
  it("inserts before a target in another folder", () => {
    expect(getRelativeMoveDestination(node("a", "1", 0), node("b", "2", 3), "before"))
      .toEqual({ parentId: "2", index: 3 });
  });

  it("inserts after a target in another folder", () => {
    expect(getRelativeMoveDestination(node("a", "1", 0), node("b", "2", 3), "after"))
      .toEqual({ parentId: "2", index: 4 });
  });

  it("adjusts the index when moving forward in the same folder", () => {
    expect(getRelativeMoveDestination(node("a", "1", 0), node("c", "1", 2), "after"))
      .toEqual({ parentId: "1", index: 2 });
  });

  it("keeps the target index when moving backward", () => {
    expect(getRelativeMoveDestination(node("c", "1", 2), node("a", "1", 0), "before"))
      .toEqual({ parentId: "1", index: 0 });
  });

  it("rejects self drops", () => {
    const item = node("a", "1", 0);
    expect(getRelativeMoveDestination(item, item, "after")).toBeNull();
  });
});
