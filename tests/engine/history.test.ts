import { describe, expect, it } from "vitest";
import { canRedo, canUndo, createHistory, push, redo, undo } from "@/lib/canvas/history";

describe("canvas history", () => {
  it("undoes and redoes in order", () => {
    let h = createHistory(1);
    h = push(h, 2);
    h = push(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(true);
  });

  it("clears redo on a new change and ignores no-op changes", () => {
    let h = push(push(createHistory("a"), "b"), "c");
    h = undo(h);
    h = push(h, "b"); // same as present
    expect(canRedo(h)).toBe(true);
    h = push(h, "d");
    expect(canRedo(h)).toBe(false);
    expect(h.past).toEqual(["a", "b"]);
  });

  it("caps the number of undo steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = push(h, i, Object.is, 3);
    expect(h.past).toEqual([7, 8, 9]);
  });

  it("undo and redo on empty stacks are no-ops", () => {
    const h = createHistory("x");
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
