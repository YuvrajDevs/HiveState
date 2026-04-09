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
  } catch (error: any) {
    console.error("❌ API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
