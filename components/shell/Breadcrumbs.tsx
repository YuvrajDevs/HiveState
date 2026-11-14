"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  tasks: "Runs", workflows: "Workflows", traces: "Traces", settings: "Settings", run: "Run a workflow",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Dashboard", href: "/" }];
  let href = "";
  parts.forEach((p, i) => {
    href += "/" + p;
    const isId = !LABELS[p] && i > 0;
    crumbs.push({ label: LABELS[p] ?? (isId ? `#${p.slice(0, 8)}` : p), href });
  });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle" />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-white">{c.label}</span>
              ) : (
                <Link href={c.href} className="truncate text-muted hover:text-white">{c.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
