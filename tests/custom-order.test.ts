import { describe, expect, it } from "vitest";
import { moveIdRelative, moveIdToEnd, orderByIds } from "../src/lib/custom-order";

describe("custom order", () => {
  it("keeps the snapshot order and moves only one id", () => {
    expect(moveIdRelative(["a", "b", "c", "d"], "d", "b", "before"))
      .toEqual(["a", "d", "b", "c"]);
  });

  it("moves an id after a target", () => {
    expect(moveIdRelative(["a", "b", "c"], "a", "b", "after"))
      .toEqual(["b", "a", "c"]);
  });

  it("moves an id to the end without duplicating it", () => {
    expect(moveIdToEnd(["a", "b", "c"], "b")).toEqual(["a", "c", "b"]);
  });

  it("orders known ids first and preserves unknown relative order", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(orderByIds(items, ["c", "a"], (item) => item.id).map((item) => item.id))
      .toEqual(["c", "a", "b", "d"]);
  });
});
