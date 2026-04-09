"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListTree, Settings, ShieldCheck, Activity, Settings2, Layers } from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: Activity },
  { name: "Workflows", href: "/workflows", icon: ListTree },
  { name: "Traces", href: "/traces", icon: Settings2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 glass-panel border-r border-white/5 h-full flex flex-col z-40 shrink-0">
      {/* Brand Section */}
      <div className="p-4 flex items-center gap-2.5 border-b border-white/5">
        <div className="w-7 h-7 bg-accent/20 border border-accent/30 flex items-center justify-center rounded-md blur-none">
          <ShieldCheck className="w-4 h-4 text-accent" />
        </div>
        <span className="font-bold tracking-tight text-base text-foreground/90">HiveState</span>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 p-3 space-y-1">
        <div className="text-[10px] font-bold text-muted/60 uppercase tracking-widest px-3 mb-3 pt-2">
          Systems Navigation
        </div>
        
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all rounded-md group
                ${isActive 
                  ? "bg-accent/10 text-accent ring-1 ring-accent/20" 
                  : "text-muted hover:text-foreground hover:bg-white/[0.03]"}
              `}
            >
              <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? "text-accent" : "text-muted/60 group-hover:text-foreground"}`} />
              {item.name}
              {isActive && (
                <div className="ml-auto w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-white/5 bg-black/10">
        <div className="flex items-center justify-between text-[10px] font-mono-data opacity-80 uppercase tracking-tighter">
          <span className="text-muted/70">Engine</span>
          <span className="text-green-500 font-bold flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Online
          </span>
        </div>
      </div>
    </aside>
  );
}
