"use client";

import type { ElementType, ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/** Consistent empty, error and loading states across pages. */

export function EmptyState({ icon: Icon, title, message, action }: { icon?: ElementType; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.01] px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 h-7 w-7 text-neutral-500" aria-hidden />}
      <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
      {message && <p className="mt-1 max-w-sm text-xs text-neutral-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/[0.06] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-red-200">{title}</h2>
          {message && <p className="mt-1 break-words font-mono-data text-xs text-red-200/80">{message}</p>}
          {onRetry && (
            <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-2.5 py-1 text-xs text-red-100 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400/60">
              <RotateCw className="h-3 w-3" /> Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.05] ${className}`} aria-hidden />;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
