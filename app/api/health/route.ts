import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { configuredProviders } from "@/lib/models";

export const dynamic = "force-dynamic";

/** Setup check for the sidebar status and onboarding: database reachable, which model providers have keys. */
export async function GET() {
  let database: "ok" | "error" = "ok";
  let queue: "ok" | "missing" = "ok";
  try {
    const { error } = await supabaseAdmin.from("workflows").select("id", { head: true, count: "exact" }).limit(1);
    if (error) database = "error";
    const q = await supabaseAdmin.from("run_jobs").select("id", { head: true, count: "exact" }).limit(1);
    if (q.error) queue = "missing";
  } catch {
    database = "error";
  }
  const providers = database === "ok" ? await configuredProviders() : { gemini: !!process.env.GEMINI_API_KEY, openai: !!process.env.OPENAI_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY };
  const mock = process.env.HIVESTATE_MOCK_LLM === "1";
  const anyProvider = mock || Object.values(providers).some(Boolean);
  return NextResponse.json({
    ready: database === "ok" && anyProvider,
    database,
    queue,
    providers,
    mock,
    // kept for older clients
    geminiConfigured: providers.gemini,
  });
}
