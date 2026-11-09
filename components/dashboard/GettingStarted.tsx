"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";

const KEY = "hivestate.onboarding.dismissed";

/**
 * First-run checklist. Steps are derived from real state (keys, workflows, runs), so it updates
 * itself as the user progresses; it can be dismissed and disappears once everything is done.
 */
export function GettingStarted({ hasProvider, hasWorkflow, hasRun, firstWorkflowId }: { hasProvider: boolean; hasWorkflow: boolean; hasRun: boolean; firstWorkflowId?: string }) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(KEY) === "1"); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      setDismissed(false);
    }
  }, []);

  const steps = [
    { done: hasProvider, title: "Connect a model provider", body: "Add a Gemini, OpenAI or Anthropic key in Settings (or as an environment variable).", href: "/settings", cta: "Open Settings" },
    { done: hasWorkflow, title: "Create a workflow", body: "Start from a template, or add agents on a blank canvas and connect them.", href: "/workflows", cta: "Browse templates" },
    { done: hasRun, title: "Run it and read the trace", body: "Give it input, watch each step stream in, then inspect inputs, outputs, tokens and cost.", href: firstWorkflowId ? `/run?id=${firstWorkflowId}` : "/run", cta: "Run a workflow" },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  if (dismissed || remaining === 0) return null;

  return (
    <section aria-labelledby="gs-title" className="rounded-md border border-accent/30 bg-accent/[0.05] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="gs-title" className="text-sm font-semibold text-white">Get started with HiveState</h2>
          <p className="mt-0.5 text-xs text-neutral-400">{3 - remaining} of 3 done. The demo workflows below are ready to explore in the meantime.</p>
        </div>
        <button onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setDismissed(true); }} className="rounded p-1 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Dismiss getting started">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`rounded-md border p-3 ${s.done ? "border-white/5 opacity-60" : "border-white/10 bg-black/20"}`}>
            <p className="flex items-center gap-2 text-xs font-semibold text-neutral-100">
              {s.done ? <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="done" /> : <Circle className="h-4 w-4 text-neutral-500" aria-label="to do" />}
              {i + 1}. {s.title}
            </p>
            <p className="mt-1 text-[11px] text-neutral-400">{s.body}</p>
            {!s.done && <Link href={s.href} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">{s.cta} →</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
