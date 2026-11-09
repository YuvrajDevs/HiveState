import { createEngine } from "@/lib/engine/engine";
import { createModelHub } from "@/lib/models/hub";
import { MemoryStore } from "@/lib/store/memory";
import type { GenerateRequest, GenerateResult } from "@/lib/models/types";
import type { Canvas, CanvasNode } from "@/lib/engine/types";

export type Handler = (req: GenerateRequest) => Promise<GenerateResult> | GenerateResult;

/** Echo-style default: output names the agent (first word of its prompt) and the input it saw. */
export const echo: Handler = (req) => {
  const text = `${req.system.split(" ")[0]}(${req.prompt})`;
  req.onDelta?.(text.slice(0, 3));
  req.onDelta?.(text.slice(3));
  return { text, inputTokens: 100, outputTokens: 50 };
};

export function agent(id: string, extra: Partial<CanvasNode["data"]> = {}, type = "AgentNode"): CanvasNode {
  return { id, type, data: { label: id.toUpperCase(), systemPrompt: `${id} agent`, model: "gemini-2.5-flash", ...extra } };
}

export function canvas(nodes: CanvasNode[], edges: Array<[string, string]>): Canvas {
  return { nodes, edges: edges.map(([source, target]) => ({ id: `${source}-${target}`, source, target })) };
}

export function setup(c: Canvas, handler: Handler = echo) {
  const store = new MemoryStore();
  const calls: GenerateRequest[] = [];
  let current = handler;
  const models = createModelHub({
    credentials: async () => ({ apiKey: "test-key" }),
    providerFactory: (id) => ({
      id,
      generate: async (req) => {
        calls.push(req);
        return current(req);
      },
    }),
    sleep: async () => undefined,
  });
  const engine = createEngine({ store, models, streamFlushMs: 1, log: { log: () => {}, warn: () => {}, error: () => {} } });
  const workflowId = store.addWorkflow({ id: "00000000-0000-4000-8000-000000000001", name: "Test", canvas_json: c });
  return {
    store,
    engine,
    calls,
    workflowId,
    setHandler: (h: Handler) => (current = h),
    stepsOf: (runId: string) => store.logs.filter((l) => l.run_id === runId),
  };
}

export function httpError(status: number, message = `HTTP ${status}`) {
  return Object.assign(new Error(message), { status });
}
