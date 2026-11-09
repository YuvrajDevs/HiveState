import { redirect } from "next/navigation";

/** Old trace URLs now open the run page, which shows the same timeline plus actions. */
export default async function TraceRedirect({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  redirect(`/tasks/${runId}`);
}
