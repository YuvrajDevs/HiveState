import { describe, expect, it } from "vitest";
import { aggregateInput, descendants, hasCycle, isHitlNode, parentMap, readyNodes, topoLevels } from "@/lib/engine/graph";
import { agent, canvas } from "../helpers";

describe("graph", () => {
  const diamond = canvas([agent("a"), agent("b"), agent("c"), agent("d")], [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]]);

  it("detects cycles, including self-loops, and accepts DAGs", () => {
    expect(hasCycle(diamond.nodes, diamond.edges)).toBe(false);
    expect(hasCycle([agent("a")], [{ source: "a", target: "a" }])).toBe(true);
    const loop = canvas([agent("a"), agent("b"), agent("c")], [["a", "b"], ["b", "c"], ["c", "a"]]);
    expect(hasCycle(loop.nodes, loop.edges)).toBe(true);
  });

  it("handles a 5,000-node chain without overflowing the stack", () => {
    const nodes = Array.from({ length: 5000 }, (_, i) => agent(`n${i}`));
    const edges = nodes.slice(1).map((n, i) => ({ source: `n${i}`, target: n.id }));
    expect(hasCycle(nodes, edges)).toBe(false);
  });

  it("groups nodes into parallel levels", () => {
    expect(topoLevels(diamond).map((l) => l.map((n) => n.id))).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("finds ready nodes and ignores dangling edges", () => {
    const parents = parentMap(diamond.nodes, [...diamond.edges, { source: "ghost", target: "a" }]);
    expect(readyNodes(diamond.nodes, parents, new Set()).map((n) => n.id)).toEqual(["a"]);
    expect(readyNodes(diamond.nodes, parents, new Set(["a", "b"])).map((n) => n.id)).toEqual(["c"]);
  });

  it("computes descendants", () => {
    expect([...descendants("b", diamond.nodes, diamond.edges)]).toEqual(["d"]);
    expect([...descendants("a", diamond.nodes, diamond.edges)].sort()).toEqual(["b", "c", "d"]);
  });

  it("builds the input for roots, single parents and merges", () => {
    const parents = parentMap(diamond.nodes, diamond.edges);
    const outputs = new Map([["a", "A"], ["b", "B"], ["c", "C"]]);
    expect(aggregateInput(diamond.nodes[0], parents, outputs, diamond.nodes, "root")).toBe("root");
    expect(aggregateInput(diamond.nodes[1], parents, outputs, diamond.nodes, "root")).toBe("A");
    expect(JSON.parse(aggregateInput(diamond.nodes[3], parents, outputs, diamond.nodes, "root")).inputs).toHaveLength(2);
  });

  it("recognises review steps", () => {
    expect(isHitlNode(agent("r", {}, "HITLNode"))).toBe(true);
    expect(isHitlNode(agent("r", { is_hitl: "true" }))).toBe(true);
    expect(isHitlNode(agent("r", { is_hitl: "false" }))).toBe(false);
  });
});
