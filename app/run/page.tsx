"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Workflow } from "lucide-react";
import { RunForm, type RunFormWorkflow } from "@/components/run/RunForm";
import { EmptyState, ErrorState } from "@/components/ui/States";

export default function RunPage() {
  return (
    <Suspense fallback={<RunSkeleton />}>
      <RunContent />
    </Suspense>
  );
}

function RunSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded bg-white/5" />
      <div className="h-80 animate-pulse rounded-md bg-white/[0.03]" />
    </div>
  );
}

function RunContent() {
  const router = useRouter();
  const initialId = useSearchParams().get("id");
  const [workflows, setWorkflows] = useState<RunFormWorkflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workflows")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load workflows");
        setWorkflows((data.workflows || []).filter((w: { is_template?: boolean }) => !w.is_template));
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2 md:py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Run a workflow</h1>
        <p className="mt-1 text-sm text-neutral-400">Pick a workflow, give it input, and start. Runs are queued and continue even if you close this tab.</p>
      </header>

      {error ? (
        <ErrorState title="Couldn't load your workflows" message={error} onRetry={() => location.reload()} />
      ) : workflows === null ? (
        <RunSkeleton />
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows to run yet"
          message="Create one from a template or start from a blank canvas, then come back here."
          action={<Link href="/workflows" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">Browse templates</Link>}
        />
      ) : (
        <section className="modern-card rounded-md p-4 md:p-5">
          <RunForm workflows={workflows} initialWorkflowId={initialId} autoFocus onStarted={(runId) => router.push(`/tasks/${runId}`)} />
        </section>
      )}
    </div>
  );
}
