import Link from "next/link";
import { Search, ScrollText } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/http/errors";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

const PAGE = 50;

/** Excerpt of `text` around the first match, so results show why they matched. */
function excerpt(text: string | null, q: string, width = 160): string | null {
  if (!text) return null;
  if (!q) return text.slice(0, width);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return null;
  const start = Math.max(0, i - width / 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + width)}${start + width < text.length ? "…" : ""}`;
}

function Marked({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return <>{parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="rounded-sm bg-yellow-400/30 text-inherit">{p}</mark> : p))}</>;
}

/**
 * Search across every step of every run: prompts, outputs, inputs and errors.
 * Server-rendered with a plain GET form, so it works without JavaScript and results are linkable.
 */
export default async function TracesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const status = sp.status === "failed" || sp.status === "success" ? sp.status : "";
  const page = Math.max(0, Number(sp.page) || 0);

  let query = supabaseAdmin
    .from("logs")
    .select("id, run_id, node_name, status, input, output, error, model_used, step_cost, created_at, run:runs(workflow:workflows(name))", { count: "exact" })
    .neq("status", "running")
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.or(`node_name.ilike.%${q}%,output.ilike.%${q}%,input.ilike.%${q}%,error.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  const { data: steps, count, error } = await query;
  if (error) throw new Error(error.message);

  const href = (p: number) => `/traces?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), page: String(p) })}`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Traces</h1>
        <p className="mt-1 text-sm text-neutral-400">Search every step of every run: names, inputs, outputs and errors.</p>
      </header>

      <form method="get" role="search" className="flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search steps</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input name="q" defaultValue={q} placeholder="e.g. rate limit, refund, SQL injection" className="w-full rounded-md border border-white/10 bg-black/20 py-2 pl-8 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
        </label>
        <select name="status" defaultValue={status} aria-label="Step status" className="rounded-md border border-white/10 bg-black/20 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
          <option value="">All steps</option>
          <option value="success">Succeeded</option>
          <option value="failed">Failed</option>
        </select>
        <button className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:brightness-110">Search</button>
      </form>

      <p className="font-mono-data text-[11px] text-neutral-500">{count ?? 0} step{count === 1 ? "" : "s"}{q && <> matching “{q}”</>}</p>

      {!steps?.length ? (
        <EmptyState icon={ScrollText} title={q ? "No steps match" : "No traces yet"} message={q ? "Try a shorter or different phrase." : "Every step a run executes is recorded here with its input, output, tokens and cost."} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-md border border-white/5 bg-surface">
          {steps.map((s) => {
            const wf = (s.run as { workflow?: { name?: string } } | null)?.workflow?.name || "Deleted workflow";
            const hit = excerpt(s.error, q) || excerpt(s.output, q) || excerpt(s.input, q) || excerpt(s.output, "") || "";
            return (
              <li key={s.id}>
                <Link href={`/tasks/${s.run_id}`} className="block px-4 py-3 hover:bg-white/[0.02] focus-visible:bg-white/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-100">
                      <Marked text={s.node_name || "Step"} q={q} /> <span className="font-normal text-neutral-500">· {wf}</span>
                    </span>
                    <span className="font-mono-data text-[11px] text-neutral-500">
                      <span className={s.status === "failed" ? "text-red-400" : s.status === "success" ? "text-green-400" : "text-yellow-400"}>{s.status}</span>
                      {s.model_used && ` · ${s.model_used}`} · ₹{Number(s.step_cost || 0).toFixed(4)} · {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                  {hit && <p className="mt-1 line-clamp-2 break-words font-mono-data text-xs text-neutral-400"><Marked text={hit} q={q} /></p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(count ?? 0) > PAGE && (
        <nav className="flex items-center justify-between text-xs" aria-label="Pagination">
          {page > 0 ? <Link href={href(page - 1)} className="text-accent hover:underline">← Newer</Link> : <span />}
          <span className="text-neutral-500">Page {page + 1} of {Math.ceil((count ?? 0) / PAGE)}</span>
          {(page + 1) * PAGE < (count ?? 0) ? <Link href={href(page + 1)} className="text-accent hover:underline">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
