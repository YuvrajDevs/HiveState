"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { canRedo, canUndo, createHistory, push, redo, undo, type History } from "./history";

/** Serialises only what the user edits: selection, drag state and measurements are not history. */
export function snapshot(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })),
  });
}

/**
 * Undo/redo for React Flow state. Changes are recorded automatically, debounced so a burst of edits
 * (typing a prompt, nudging a node) becomes one step, and never in the middle of a drag.
 */
export function useCanvasHistory(
  nodes: Node[],
  edges: Edge[],
  apply: (nodes: Node[], edges: Edge[]) => void,
  enabled: boolean,
) {
  const [history, setHistory] = useState<History<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (nodes.some((n) => n.dragging)) return;
    const snap = snapshot(nodes, edges);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setHistory((h) => (h ? push(h, snap) : createHistory(snap)));
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [nodes, edges, enabled]);

  const restore = useCallback(
    (snap: string) => {
      const parsed = JSON.parse(snap) as { nodes: Node[]; edges: Edge[] };
      apply(parsed.nodes, parsed.edges);
    },
    [apply],
  );

  const doUndo = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setHistory((h) => {
      if (!h) return h;
      // Flush a pending edit first, so undo reverts it rather than the one before.
      const current = snapshot(nodes, edges);
      const base = current !== h.present ? push(h, current) : h;
      if (!canUndo(base)) return base;
      const next = undo(base);
      restore(next.present);
      return next;
    });
  }, [nodes, edges, restore]);

  const doRedo = useCallback(() => {
    setHistory((h) => {
      if (!h || !canRedo(h)) return h;
      const next = redo(h);
      restore(next.present);
      return next;
    });
  }, [restore]);

  /** Starts a fresh history (after loading or restoring a saved version). */
  const reset = useCallback((n: Node[], e: Edge[]) => setHistory(createHistory(snapshot(n, e))), []);

  return {
    undo: doUndo,
    redo: doRedo,
    reset,
    canUndo: !!history && (canUndo(history) || snapshot(nodes, edges) !== history.present),
    canRedo: !!history && canRedo(history),
  };
}
