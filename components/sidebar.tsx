"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Workflow, Play, Activity, ScrollText, Settings, ShieldCheck, X } from "lucide-react";

type Item = { name: string; href: string; icon: React.ElementType; exact?: boolean; badge?: boolean };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Build",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
      { name: "Workflows", href: "/workflows", icon: Workflow },
      { name: "Run a workflow", href: "/run", icon: Play },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Runs", href: "/tasks", icon: Activity, badge: true },
      { name: "Traces", href: "/traces", icon: ScrollText },
    ],
  },
  { label: "Admin", items: [{ name: "Settings", href: "/settings", icon: Settings }] },
];

type Health = { ready: boolean; database: string; geminiConfigured: boolean } | null;

function usePoll<T>(url: string, ms: number, initial: T): T {
  const [data, setData] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (alive && r.ok) setData(await r.json());
      } catch {
        /* offline: keep last value */
      }
    };
    load();
    const t = setInterval(load, ms);
    return () => { alive = false; clearInterval(t); };
  }, [url, ms]);
  return data;
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { count } = usePoll<{ count: number }>("/api/attention", 15000, { count: 0 });
  const health = usePoll<Health>("/api/health", 60000, null);

  // close the mobile drawer after navigating
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} aria-hidden />}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-white/10 bg-sidebar transition-transform md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2.5 border-b border-white/10 p-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-accent/30 bg-accent/20">
              <ShieldCheck className="h-4 w-4 text-accent" />
            </div>
            <span className="text-base font-bold tracking-tight">HiveState</span>
          </Link>
          <button onClick={onClose} className="rounded p-1.5 text-muted hover:bg-white/5 md:hidden" aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-micro font-semibold text-muted">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          active ? "bg-accent/15 text-white ring-1 ring-accent/30" : "text-muted hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-subtle group-hover:text-white"}`} />
                        <span className="flex-1">{item.name}</span>
                        {item.badge && count > 0 && (
                          <span
                            title={`${count} run${count === 1 ? "" : "s"} waiting for you`}
                            className="min-w-5 rounded-full bg-white/10 px-1.5 py-0.5 text-center text-micro font-bold leading-none text-foreground"
                          >
                            {count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          {health === null ? (
            <p className="text-xs text-muted">Checking setup…</p>
          ) : health.ready ? (
            <p className="flex items-center gap-2 text-xs text-foreground/80">
              <span className="h-2 w-2 rounded-full bg-success" /> Connected · database &amp; Gemini ready
            </p>
          ) : (
            <Link href="/settings" className="block rounded-md border border-white/10 bg-white/[0.04] p-2.5 text-xs text-warning hover:bg-white/[0.04]">
              <span className="font-semibold">Setup needed</span>
              <span className="mt-0.5 block text-warning/80">
                {health.database !== "ok" ? "Can't reach the database. Check SUPABASE_URL and the service key." : "GEMINI_API_KEY is missing."}
              </span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
