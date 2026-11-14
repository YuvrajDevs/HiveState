import crypto from "node:crypto";
import type { CanvasEdge, CanvasNode } from "@/types/domain";

/**
 * Pure workflow-graph logic, kept free of I/O so it can be tested directly (lib/engine/graph.test.ts).
 * The runner in runner.ts uses these to decide what runs next.
 */

/** Consecutive failed levels before a run is stopped instead of retried. */
export const CIRCUIT_BREAKER_THRESHOLD = 3;

export const isCircuitBroken = (consecutiveFailures: number) => consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD;

/** Map of node id to the ids of the nodes it depends on. */
export function parentsOf(nodes: CanvasNode[], edges: CanvasEdge[]): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  nodes.forEach((n) => parents.set(n.id, []));
  edges.forEach((e) => parents.get(e.target)?.push(e.source));
  return parents;
}

/** Nodes with no dependencies: where a run starts. */
export function entryNodes(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  const parents = parentsOf(nodes, edges);
  return nodes.filter((n) => (parents.get(n.id) ?? []).length === 0);
}

/** Nodes not yet done whose dependencies are all done. They run together, in parallel. */
export function readyNodes(nodes: CanvasNode[], edges: CanvasEdge[], completed: ReadonlySet<string>): CanvasNode[] {
  const parents = parentsOf(nodes, edges);
  return nodes.filter((n) => !completed.has(n.id) && (parents.get(n.id) ?? []).every((p) => completed.has(p)));
}

/** True when the edges form a loop, which would make a run never finish. */
export function hasCycle(nodes: CanvasNode[], edges: CanvasEdge[]): boolean {
  const next = new Map<string, string[]>();
  nodes.forEach((n) => next.set(n.id, []));
  edges.forEach((e) => next.get(e.source)?.push(e.target));
  const done = new Set<string>();
  const onPath = new Set<string>();
  const visit = (id: string): boolean => {
    if (onPath.has(id)) return true;
    if (done.has(id)) return false;
    onPath.add(id);
    for (const n of next.get(id) ?? []) if (visit(n)) return true;
    onPath.delete(id);
    done.add(id);
    return false;
  };
  return nodes.some((n) => visit(n.id));
}

/** A step's identity: the same run, node, input and prompt give the same fingerprint, so a resumed run can skip it. */
export function stepFingerprint(runId: string, nodeId: string, input: string, systemPrompt: string): string {
  return crypto.createHash("sha256").update(`${runId}:${nodeId}:${input}:${systemPrompt}`).digest("hex");
}
