import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Shown when data could not be loaded. Says what failed in plain words and offers a retry, instead of a raw
 * exception or an empty state that would wrongly suggest there is nothing there.
 */
export function LoadError({ what, retryHref }: { what: string; retryHref: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-14 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-danger" aria-hidden>
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h2 className="text-base font-semibold">Couldn&rsquo;t load {what}</h2>
      <p className="max-w-sm text-sm text-muted">The database didn&rsquo;t answer. Check the connection in Settings, then try again.</p>
      {/* A plain link reloads server-rendered pages too */}
      <a href={retryHref} className="mt-1 inline-flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-border">
        <RotateCw className="h-4 w-4" aria-hidden /> Try again
      </a>
    </div>
  );
}
