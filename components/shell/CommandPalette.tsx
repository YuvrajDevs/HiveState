"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";

type Cmd = { id: string; label: string; hint: string; href: string };

const PAGES: Cmd[] = [
  { id: "p-dash", label: "Dashboard", hint: "Page", href: "/" },
  { id: "p-wf", label: "Workflows", hint: "Page", href: "/workflows" },
  { id: "p-run", label: "Run a workflow", hint: "Action", href: "/run" },
  { id: "p-tasks", label: "Tasks", hint: "Page", href: "/tasks" },
  { id: "p-traces", label: "Traces", hint: "Page", href: "/traces" },
  { id: "p-set", label: "Settings", hint: "Page", href: "/settings" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mount only while open so the query/selection reset naturally each time.
  return open ? <Palette onClose={onClose} /> : null;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [workflows, setWorkflows] = useState<Cmd[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/workflows").then((r) => r.json()).then((d) => {
      const list: Cmd[] = [];
      for (const w of (d.workflows || []).filter((w: any) => !w.is_template)) {
        list.push({ id: `o-${w.id}`, label: `Open ${w.name}`, hint: "Workflow", href: `/workflows/${w.id}` });
        list.push({ id: `r-${w.id}`, label: `Run ${w.name}`, hint: "Action", href: `/run?id=${w.id}` });
      }
      setWorkflows(list);
    }).catch(() => {});
  }, []);

  const results = useMemo(() => {
    const all = [...PAGES, ...workflows];
    const t = q.trim().toLowerCase();
    return t ? all.filter((c) => c.label.toLowerCase().includes(t)) : all.slice(0, 8);
  }, [q, workflows]);

  const go = (c?: Cmd) => { if (c) { router.push(c.href); onClose(); } };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[15vh]" onMouseDown={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Quick navigation"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#141414] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
        }}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search className="h-4 w-4 text-neutral-500" />
          <input
            ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Jump to a page or workflow…" aria-label="Search"
            role="combobox" aria-expanded="true" aria-controls="cmd-list"
            className="h-12 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
          />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-neutral-400">Esc</kbd>
        </div>
        <ul id="cmd-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">No matches</li>}
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)} onClick={() => go(c)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${i === active ? "bg-accent/15 text-white" : "text-neutral-300"}`}
              >
                <span className="truncate">{c.label}</span>
                <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                  {c.hint}{i === active && <CornerDownLeft className="h-3 w-3" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
