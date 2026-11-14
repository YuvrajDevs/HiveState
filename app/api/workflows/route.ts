import { errorMessage } from "@/lib/errors";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: workflows, error } = await supabaseAdmin
      .from("workflows")
      .select("id, name, is_template, canvas_json, created_at")
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ workflows });
  } catch (error: unknown) {
    console.error("❌ API Error:", errorMessage(error));
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
