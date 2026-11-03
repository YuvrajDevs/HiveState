import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Real setup check for the sidebar status pill (replaces the old hard-coded "Online"). */
export async function GET() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  let database: "ok" | "error" = "ok";
  try {
    const { error } = await supabaseAdmin.from("workflows").select("id", { head: true, count: "exact" }).limit(1);
    if (error) database = "error";
  } catch {
    database = "error";
  }
  const ready = geminiConfigured && database === "ok";
  return NextResponse.json({ ready, database, geminiConfigured });
}
