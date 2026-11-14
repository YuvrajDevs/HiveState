"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Menu, Search, Play } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { CommandPalette } from "@/components/shell/CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Sidebar open={menuOpen} onClose={closeMenu} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[var(--color-background)]/90 px-4 backdrop-blur">
          <button onClick={() => setMenuOpen(true)} className="rounded-md p-2 text-foreground/80 hover:bg-white/5 md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1"><Breadcrumbs /></div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-sm text-muted hover:border-white/20 hover:text-white sm:flex"
            aria-label="Open quick navigation"
          >
            <Search className="h-3.5 w-3.5" /> Search
            <kbd className="ml-2 rounded border border-white/10 px-1.5 text-micro">⌘K</kbd>
          </button>
          <button onClick={() => setPaletteOpen(true)} className="rounded-md p-2 text-foreground/80 hover:bg-white/5 sm:hidden" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          <Link href="/run" className="flex items-center gap-2 rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-white hover:brightness-110">
            <Play className="h-3.5 w-3.5 fill-current" /> <span className="hidden sm:inline">New run</span>
          </Link>
        </header>
        <main id="content" className="bg-grid relative min-w-0 flex-1 overflow-y-auto">
          <div className="relative h-full w-full p-4 md:p-6">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
