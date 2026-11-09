"use client";

import { useId } from "react";
import type { Node } from "@xyflow/react";
import { X, Trash2 } from "lucide-react";
import { MODELS, PROVIDER_LABELS, DEFAULT_MODEL, resolveModelId, type ProviderId } from "@/lib/models/catalog";
import { extractVariables } from "@/lib/engine/template";

const PROVIDERS: ProviderId[] = ["gemini", "openai", "anthropic"];

/** Properties of the selected step: prompt, model, reliability settings. Full-width sheet on phones. */
export default function CanvasSidebar({
  selectedNode,
  onUpdate,
  onDelete,
  onClose,
}: {
  selectedNode: Node | null;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const ids = useId();
  if (!selectedNode) return null;
  const data = selectedNode.data as Record<string, unknown>;
  const set = (field: string, value: unknown) => onUpdate(selectedNode.id, { [field]: value });
  const isAgent = selectedNode.type !== "HITLNode";
  const model = resolveModelId((data.model as string) || DEFAULT_MODEL);
  const vars = extractVariables(String(data.systemPrompt || data.instructions || ""));
  const field = "w-full rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/60";
  const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400";

  return (
    <aside
      aria-label="Step settings"
      className="glass-panel absolute inset-x-0 bottom-0 z-20 flex max-h-[70%] flex-col border-t border-white/10 sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:max-h-none sm:w-80 sm:border-l sm:border-t-0"
    >
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <h2 className="text-xs font-semibold text-white">{isAgent ? "Agent" : "Review step"}</h2>
        <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Close step settings">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label htmlFor={`${ids}-label`} className={label}>Name</label>
          <input id={`${ids}-label`} value={String(data.label || "")} onChange={(e) => set("label", e.target.value)} className={field} placeholder="e.g. Researcher" />
        </div>

        {isAgent ? (
          <>
            <div>
              <label htmlFor={`${ids}-model`} className={label}>Model</label>
              <select id={`${ids}-model`} value={model} onChange={(e) => set("model", e.target.value)} className={field}>
                {PROVIDERS.map((p) => (
                  <optgroup key={p} label={PROVIDER_LABELS[p]}>
                    {MODELS.filter((m) => m.provider === p).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} · ${m.input}/${m.output} per 1M
                      </option>
                    ))}
                  </optgroup>
                ))}
                {!MODELS.some((m) => m.id === model) && <option value={model}>{model}</option>}
              </select>
              <p className="mt-1 text-[11px] text-neutral-500">If this model fails, the fallback model from Settings is used.</p>
            </div>

            <div>
              <label htmlFor={`${ids}-prompt`} className={label}>Instructions (system prompt)</label>
              <textarea
                id={`${ids}-prompt`}
                value={String(data.systemPrompt || "")}
                onChange={(e) => set("systemPrompt", e.target.value)}
                rows={9}
                className={`${field} resize-y font-mono-data leading-relaxed`}
                placeholder="What should this agent do with its input? Use {{name}} for values supplied per run."
              />
              {vars.length > 0 && <p className="mt-1 font-mono-data text-[11px] text-accent/80">Variables: {vars.map((v) => `{{${v}}}`).join(" ")}</p>}
            </div>

            <fieldset className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
              <legend className={`${label} col-span-2`}>Reliability</legend>
              <div>
                <label htmlFor={`${ids}-retries`} className="mb-1 block text-[11px] text-neutral-400">Retries</label>
                <input id={`${ids}-retries`} type="number" min={0} max={5} value={Number(data.retries ?? 2)} onChange={(e) => set("retries", Math.max(0, Math.min(5, Number(e.target.value) || 0)))} className={field} />
              </div>
              <div>
                <label htmlFor={`${ids}-timeout`} className="mb-1 block text-[11px] text-neutral-400">Timeout (s)</label>
                <input id={`${ids}-timeout`} type="number" min={5} max={300} value={Math.round(Number(data.timeoutMs ?? 90000) / 1000)} onChange={(e) => set("timeoutMs", Math.max(5, Math.min(300, Number(e.target.value) || 90)) * 1000)} className={field} />
              </div>
              <p className="col-span-2 text-[11px] text-neutral-500">Retries apply to rate limits, server errors and timeouts, with exponential backoff.</p>
            </fieldset>

            <label className="flex cursor-pointer items-start justify-between gap-3 border-t border-white/5 pt-4">
              <span>
                <span className="block text-xs font-semibold text-neutral-200">Review before running</span>
                <span className="text-[11px] text-neutral-500">Pause and wait for approval before this agent runs.</span>
              </span>
              <input type="checkbox" checked={data.is_hitl === true || data.is_hitl === "true"} onChange={(e) => set("is_hitl", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#3b82f6]" />
            </label>
          </>
        ) : (
          <div>
            <label htmlFor={`${ids}-instr`} className={label}>Instructions for the reviewer</label>
            <textarea id={`${ids}-instr`} value={String(data.instructions || "")} onChange={(e) => set("instructions", e.target.value)} rows={5} className={`${field} resize-y`} placeholder="What should the reviewer check?" />
            <p className="mt-1 text-[11px] text-neutral-500">The run pauses here. Approving passes the input through, with any note you add.</p>
          </div>
        )}
      </div>

      <footer className="border-t border-white/5 p-3">
        <button onClick={() => onDelete(selectedNode.id)} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
          <Trash2 className="h-3.5 w-3.5" /> Delete step
        </button>
      </footer>
    </aside>
  );
}
