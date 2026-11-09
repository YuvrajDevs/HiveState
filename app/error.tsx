"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/States";

/** Route-level error boundary: keeps the shell usable when one page fails to load. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  // In production React replaces server error messages with a generic one; show something useful instead.
  const hidden = error.message.startsWith("An error occurred in the Server Components render");
  const dbHint = /supabase|fetch failed|ECONNREFUSED|API key/i.test(error.message);
  return (
    <div className="mx-auto max-w-xl space-y-3 py-10">
      <ErrorState
        title="This page couldn't load"
        message={
          dbHint ? "The database could not be reached. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
          : hidden ? "The server could not load this page. Usually the database is unreachable or a migration has not been applied; the server log has details."
          : error.message
        }
        onRetry={reset}
      />
      <p className="text-xs text-neutral-400">
        If it keeps happening, check <Link href="/settings" className="text-accent underline">Settings</Link>.{error.digest && <> Reference: <code className="font-mono-data">{error.digest}</code></>}
      </p>
    </div>
  );
}
