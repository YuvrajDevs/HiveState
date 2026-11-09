import { topoLevels, parentMap } from "./graph";
import { renderTemplate } from "./template";
import { approxTokens, costInr, getModel, resolveModelId, DEFAULT_MODEL } from "../models/catalog";
import type { Canvas } from "./types";

/**
 * Pre-run cost estimate. Input tokens are counted from the real prompts; output length is unknown
 * before the run, so each agent assumes `expectedOutputTokens` (default 700) and the range spans
 * half to double that. Downstream inputs are the upstream outputs, so the error compounds along a chain;
 * the range is meant to answer "pennies or rupees?", not to bill.
 */

export const DEFAULT_OUTPUT_TOKENS = 700;

export interface NodeEstimate {
  nodeId: string;
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CostEstimate {
  nodes: NodeEstimate[];
  inputTokens: number;
  outputTokens: number;
  expected: number;
  low: number;
  high: number;
  currency: "INR";
}

export function estimateRunCost(canvas: Canvas, input: string, variables: Record<string, string> = {}): CostEstimate {
  const parents = parentMap(canvas.nodes, canvas.edges);
  const outTokens = new Map<string, number>();
  const nodes: NodeEstimate[] = [];
  const rootTokens = approxTokens(renderTemplate(input, variables));

  for (const level of topoLevels(canvas)) {
    for (const node of level) {
      const isReview = node.type === "HITLNode" || node.type === "human";
      const ps = parents.get(node.id) || [];
      const upstream = ps.length === 0 ? rootTokens : ps.reduce((s, p) => s + (outTokens.get(p) || 0), 0) + (ps.length > 1 ? 20 * ps.length : 0);
      if (isReview) {
        outTokens.set(node.id, upstream); // passes its input through, costs nothing
        continue;
      }
      const model = resolveModelId(node.data.model || DEFAULT_MODEL);
      const inputTokens = upstream + approxTokens(renderTemplate(node.data.systemPrompt || "", variables));
      const outputTokens = Number(node.data.expectedOutputTokens) || DEFAULT_OUTPUT_TOKENS;
      outTokens.set(node.id, outputTokens);
      nodes.push({
        nodeId: node.id,
        label: node.data.label || "Agent",
        model: getModel(model)?.label || model,
        inputTokens,
        outputTokens,
        cost: costInr(model, inputTokens, outputTokens),
      });
    }
  }

  const sum = (f: (n: NodeEstimate) => number) => nodes.reduce((s, n) => s + f(n), 0);
  const modelOf = (n: NodeEstimate) => canvas.nodes.find((c) => c.id === n.nodeId)?.data.model;
  return {
    nodes,
    inputTokens: sum((n) => n.inputTokens),
    outputTokens: sum((n) => n.outputTokens),
    expected: sum((n) => n.cost),
    low: sum((n) => costInr(modelOf(n), n.inputTokens, n.outputTokens * 0.5)),
    high: sum((n) => costInr(modelOf(n), n.inputTokens * 1.5, n.outputTokens * 2)),
    currency: "INR",
  };
}
