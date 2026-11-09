import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { drainQueue } from "@/lib/queue/worker";
import { workerDeps } from "@/lib/queue/dispatch";
import { errorResponse } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Picks up queued jobs and jobs whose worker died. Meant for a scheduler (Vercel Cron, a GitHub Actions
 * schedule, or any free pinger) and protected by CRON_SECRET. Disabled when CRON_SECRET is not set.
 */
async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Set CRON_SECRET to enable this endpoint." }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await drainQueue(workerDeps(), { workerId: `cron-${crypto.randomUUID().slice(0, 8)}`, maxJobs: 5, budgetMs: 240_000 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "drain");
  }
}

export const GET = handle;
export const POST = handle;
