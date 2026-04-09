import { NextRequest, NextResponse } from "next/server";
import { runWorkflow } from "@/lib/engine/runner";

export async function POST(req: NextRequest) {
  try {
    const { workflowId, input } = await req.json();

    if (!workflowId || !input) {
      return NextResponse.json(
        { error: "workflowId and input are required" },
        { status: 400 }
      );
    }

    const result = await runWorkflow(workflowId, input);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Run Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run workflow" },
      { status: 500 }
    );
  }
}
