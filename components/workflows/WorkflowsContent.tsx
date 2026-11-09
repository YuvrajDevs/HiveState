"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Plus, Play, Pencil, Copy, Trash2, Search, Loader2, Workflow, LayoutTemplate } from "lucide-react";
import { createWorkflow, createFromTemplate, renameWorkflow, duplicateWorkflow, deleteWorkflow } from "@/app/actions/workflow";
import { EmptyState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";

export interface WorkflowRow {
  id: string;
  name: string;
  templateName?: string | null;
  description?: string | null;
  steps: number;
  version: number;
  createdAt: string;
  runs: number;
  successRate: number | null;
  lastRun: string | null;
}

type Dialog = { kind: "create" } | { kind: "template"; t: WorkflowRow } | { kind: "rename"; w: WorkflowRow } | null;

export default function WorkflowsContent({ workflows, templates }: { workflows: WorkflowRow[]; templates: WorkflowRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "runs">("recent");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = workflows.filter((w) => !needle || w.name.toLowerCase().includes(needle));
    return [...rows].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "runs" ? b.runs - a.runs : (b.lastRun || b.createdAt).localeCompare(a.lastRun || a.createdAt),
    );
  }, [workflows, q, sort]);

  const open = (d: Dialog, initial: string) => { setDialog(d); setName(initial); setError(null); };

  const submit = async () => {
    if (!dialog || !name.trim()) return;
    setBusy("dialog");
    const res =
      dialog.kind === "create" ? await createWorkflow(name.trim())
      : dialog.kind === "template" ? await createFromTemplate(dialog.t.id, name.trim())
      : await renameWorkflow(dialog.w.id, name.trim());
    setBusy(null);
    if (res.error) return setError(res.error);
    setDialog(null);
    if (dialog.kind === "rename") router.refresh();
    else if (res.data) router.push(`/workflows/${res.data.id}`);
  };

  const duplicate = async (w: WorkflowRow) => {
    setBusy(`dup-${w.id}`);
    const res = await duplicateWorkflow(w.id);
    setBusy(null);
    if (res.data) router.refresh();
    else alert(res.error);
  };

  const remove = async (w: WorkflowRow) => {
    if (!confirm(`Delete “${w.name}”? Its ${w.runs} run(s) stay in history.`)) return;
    setBusy(`del-${w.id}`);
    const res = await deleteWorkflow(w.id);
    setBusy(null);
    if (res.error) alert(res.error);
    router.refresh();
  };

  const iconBtn = "rounded p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-neutral-400">Each workflow is a graph of agents. Edit it on the canvas, run it with different inputs, and roll back to any saved version.</p>
        </div>
        <button onClick={() => open({ kind: "create" }, "")} className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110">
          <Plus className="h-4 w-4" /> New workflow
        </button>
      </header>

      <section aria-labelledby="mine" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mine" className="mr-auto text-sm font-semibold text-neutral-200">Your workflows <span className="text-neutral-500">({workflows.length})</span></h2>
          <label className="relative">
            <span className="sr-only">Search workflows</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-48 rounded-md border border-white/10 bg-black/20 py-1.5 pl-7 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
          </label>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none">
            <option value="recent">Recently used</option>
            <option value="runs">Most runs</option>
            <option value="name">Name</option>
          </select>
        </div>

        {workflows.length === 0 ? (
          <EmptyState icon={Workflow} title="No workflows yet" message="Start from one of the templates below, or create a blank workflow and add agents on the canvas." />
        ) : list.length === 0 ? (
          <EmptyState icon={Search} title="No workflows match" />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((w) => (
              <li key={w.id} className="modern-card flex flex-col rounded-md p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/workflows/${w.id}`} className="min-w-0 font-semibold text-neutral-100 hover:text-accent focus-visible:underline">
                    <span className="block truncate">{w.name}</span>
                  </Link>
                  <div className="flex shrink-0">
                    <button onClick={() => open({ kind: "rename", w }, w.name)} className={iconBtn} aria-label={`Rename ${w.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => duplicate(w)} disabled={!!busy} className={iconBtn} aria-label={`Duplicate ${w.name}`}>{busy === `dup-${w.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}</button>
                    <button onClick={() => remove(w)} disabled={!!busy} className={iconBtn} aria-label={`Delete ${w.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <p className="mt-1 font-mono-data text-[11px] text-neutral-500">
                  {w.steps} steps · v{w.version || 0} · {w.runs} runs{w.successRate !== null && ` · ${w.successRate}% completed`}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500" suppressHydrationWarning>{w.lastRun ? `Last run ${formatDistanceToNow(new Date(w.lastRun), { addSuffix: true })}` : "Never run"}</p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/workflows/${w.id}`} className="flex-1 rounded-md border border-white/10 py-1.5 text-center text-xs font-semibold text-neutral-200 hover:bg-white/5">Edit</Link>
                  <Link href={`/run?id=${w.id}`} aria-disabled={w.steps === 0} className={`flex flex-1 items-center justify-center gap-1 rounded-md border border-accent/30 bg-accent/10 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 ${w.steps === 0 ? "pointer-events-none opacity-40" : ""}`}>
                    <Play className="h-3 w-3 fill-current" /> Run
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="templates" className="space-y-3">
        <h2 id="templates" className="flex items-center gap-2 text-sm font-semibold text-neutral-200"><LayoutTemplate className="h-4 w-4 text-neutral-500" /> Start from a template</h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-col rounded-md border border-dashed border-white/10 p-4">
              <h3 className="font-semibold text-neutral-100">{t.templateName || t.name}</h3>
              <p className="mt-1 flex-1 text-xs text-neutral-400">{t.description}</p>
              <p className="mt-2 font-mono-data text-[11px] text-neutral-500">{t.steps} steps</p>
              <button onClick={() => open({ kind: "template", t }, t.templateName || t.name)} className="mt-3 rounded-md border border-white/10 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-white/5">Use template</button>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={!!dialog} onClose={() => setDialog(null)} title={dialog?.kind === "rename" ? "Rename workflow" : dialog?.kind === "template" ? "Create from template" : "New workflow"}>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-neutral-300">Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full rounded-md border border-white/10 bg-white/[0.03] p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
          </label>
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDialog(null)} className="rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
            <button disabled={!name.trim() || busy === "dialog"} className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
              {busy === "dialog" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {dialog?.kind === "rename" ? "Save" : "Create and open"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
