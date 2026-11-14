import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanvasEdge, CanvasNode } from "../../types/domain";
import { CIRCUIT_BREAKER_THRESHOLD, entryNodes, hasCycle, isCircuitBroken, readyNodes, stepFingerprint } from "./graph";

const node = (id: string): CanvasNode => ({ id, type: "AgentNode", data: { label: id } });
const edge = (source: string, target: string): CanvasEdge => ({ id: `${source}-${target}`, source, target });
const ids = (ns: CanvasNode[]) => ns.map((n) => n.id).sort();

// research → (draft, fact-check) → edit: a diamond, the shape that needs parallel levels
const nodes = ["research", "draft", "check", "edit"].map(node);
const edges = [edge("research", "draft"), edge("research", "check"), edge("draft", "edit"), edge("check", "edit")];

describe("dependency order", () => {
  it("starts at the nodes with no dependencies", () => {
    assert.deepEqual(ids(entryNodes(nodes, edges)), ["research"]);
  });

  it("runs independent nodes in the same level", () => {
    assert.deepEqual(ids(readyNodes(nodes, edges, new Set(["research"]))), ["check", "draft"]);
  });

  it("waits for every parent before a node is ready", () => {
    assert.deepEqual(ids(readyNodes(nodes, edges, new Set(["research", "draft"]))), ["check"]);
    assert.deepEqual(ids(readyNodes(nodes, edges, new Set(["research", "draft", "check"]))), ["edit"]);
  });

  it("has nothing ready once every node is done", () => {
    assert.deepEqual(readyNodes(nodes, edges, new Set(nodes.map((n) => n.id))), []);
  });

  it("treats unconnected nodes as separate entry points", () => {
    assert.deepEqual(ids(entryNodes([node("a"), node("b")], [])), ["a", "b"]);
  });
});

describe("cycles", () => {
  it("accepts a graph without loops", () => {
    assert.equal(hasCycle(nodes, edges), false);
  });

  it("rejects a loop before the run starts", () => {
    assert.equal(hasCycle(nodes, [...edges, edge("edit", "research")]), true);
  });

  it("rejects a node that depends on itself", () => {
    assert.equal(hasCycle([node("a")], [edge("a", "a")]), true);
  });
});

describe("resume", () => {
  it("gives the same step the same fingerprint, so a resumed run can skip it", () => {
    assert.equal(stepFingerprint("run1", "draft", "input", "prompt"), stepFingerprint("run1", "draft", "input", "prompt"));
  });

  it("re-runs a step whose input or prompt changed", () => {
    const base = stepFingerprint("run1", "draft", "input", "prompt");
    assert.notEqual(stepFingerprint("run1", "draft", "edited input", "prompt"), base);
    assert.notEqual(stepFingerprint("run1", "draft", "input", "new prompt"), base);
    assert.notEqual(stepFingerprint("run2", "draft", "input", "prompt"), base);
  });
});

describe("circuit breaker", () => {
  it(`stops a run after ${CIRCUIT_BREAKER_THRESHOLD} failures in a row, not before`, () => {
    assert.equal(isCircuitBroken(CIRCUIT_BREAKER_THRESHOLD - 1), false);
    assert.equal(isCircuitBroken(CIRCUIT_BREAKER_THRESHOLD), true);
  });
});
