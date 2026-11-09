import type { Canvas, CanvasEdge, CanvasNode } from "./types";

/** Pure graph helpers for the canvas DAG. No I/O, so the scheduling rules can be tested in isolation. */

export function parentMap(nodes: CanvasNode[], edges: CanvasEdge[]): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  nodes.forEach((n) => parents.set(n.id, []));
  edges.forEach((e) => {
    if (!parents.has(e.target) || !parents.has(e.source)) return; // ignore dangling edges
    const list = parents.get(e.target)!;
    if (!list.includes(e.source)) list.push(e.source);
  });
  return parents;
}

export function childMap(nodes: CanvasNode[], edges: CanvasEdge[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  nodes.forEach((n) => children.set(n.id, []));
  edges.forEach((e) => {
    if (!children.has(e.source) || !children.has(e.target)) return;
    const list = children.get(e.source)!;
    if (!list.includes(e.target)) list.push(e.target);
  });
  return children;
}

/** Iterative DFS with colouring, so very deep graphs cannot blow the stack. */
export function hasCycle(nodes: CanvasNode[], edges: CanvasEdge[]): boolean {
  const children = childMap(nodes, edges);
  const state = new Map<string, 0 | 1 | 2>(); // 0 unseen, 1 on stack, 2 done
  for (const start of nodes) {
    if (state.get(start.id)) continue;
    const stack: Array<{ id: string; i: number }> = [{ id: start.id, i: 0 }];
    state.set(start.id, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = children.get(top.id)?.[top.i++];
      if (next === undefined) {
        state.set(top.id, 2);
        stack.pop();
      } else if (state.get(next) === 1) {
        return true;
      } else if (!state.get(next)) {
        state.set(next, 1);
        stack.push({ id: next, i: 0 });
      }
    }
  }
  return false;
}

/** Nodes whose parents are all complete and which are not complete themselves. */
export function readyNodes(nodes: CanvasNode[], parents: Map<string, string[]>, completed: Set<string>): CanvasNode[] {
  return nodes.filter((n) => !completed.has(n.id) && (parents.get(n.id) || []).every((p) => completed.has(p)));
}

/** Groups nodes into dependency levels (Kahn's algorithm). Nodes in one level can run in parallel. */
export function topoLevels(canvas: Canvas): CanvasNode[][] {
  const parents = parentMap(canvas.nodes, canvas.edges);
  const done = new Set<string>();
  const levels: CanvasNode[][] = [];
  while (done.size < canvas.nodes.length) {
    const level = readyNodes(canvas.nodes, parents, done);
    if (level.length === 0) break; // cycle or unreachable
    level.forEach((n) => done.add(n.id));
    levels.push(level);
  }
  return levels;
}

/** Every node reachable from `nodeId` (excluding the node itself). */
export function descendants(nodeId: string, nodes: CanvasNode[], edges: CanvasEdge[]): Set<string> {
  const children = childMap(nodes, edges);
  const seen = new Set<string>();
  const queue = [...(children.get(nodeId) || [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(children.get(id) || []));
  }
  return seen;
}

export function isHitlNode(node: CanvasNode): boolean {
  const flag = node.data?.is_hitl;
  return node.type === "HITLNode" || node.type === "human" || flag === true || flag === "true";
}

/**
 * The input a node receives: the run input for roots, the parent's output for a single parent,
 * and a labelled JSON envelope when several branches merge.
 */
export function aggregateInput(
  node: CanvasNode,
  parents: Map<string, string[]>,
  outputs: Map<string, string>,
  nodes: CanvasNode[],
  rootInput: string,
): string {
  const ps = parents.get(node.id) || [];
  if (ps.length === 0) return rootInput;
  if (ps.length === 1) return outputs.get(ps[0]) || "";
  const inputs = ps.map((pId) => ({
    source_node: nodes.find((n) => n.id === pId)?.data?.label || "Previous Agent",
    content: outputs.get(pId) || "",
  }));
  return JSON.stringify({ inputs });
}

export const MULTI_INPUT_PREFIX = '{"inputs":';
