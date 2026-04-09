import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supabaseAdmin } from "../lib/supabase";
import { runWorkflow } from "../lib/engine/runner";

async function seedAndTestGemini() {
  console.log("🚀 Starting HiveState 'Gemini Engine' Test...");

  /**
   * IMPORTANT: Ensure you have run the consolidated SQL migration
   * in your Supabase SQL Editor before running this test.
   */

  try {
    // 1. Create a Test Workflow
    const workflowName = `Gemini Pipeline: ${new Date().toLocaleTimeString()}`;
    const { data: workflow, error: workflowErr } = await supabaseAdmin
      .from("workflows")
      .insert({ name: workflowName })
      .select()
      .single();

    if (workflowErr || !workflow) throw new Error(`Workflow seed failed: ${workflowErr?.message}`);
    console.log(`✅ Created Workflow: ${workflow.id}`);

    // 2. Create Agents for Gemini
    const agents = [
      {
        workflow_id: workflow.id,
        name: "Gemini Analyst",
        system_prompt: "You are a logical analyst. Break down the user input into 3 key bullet points.",
        model: "gemini-2.5-flash-lite",
        order_index: 0,
      },
      {
        workflow_id: workflow.id,
        name: "Gemini Narrator",
        system_prompt: "You are a creative writer. Turn the input bullet points into a dramatic 1-sentence narrative.",
        model: "gemini-2.5-flash-lite",
        order_index: 1,
      },
    ];

    const { error: agentsErr } = await supabaseAdmin.from("agents").insert(agents);
    if (agentsErr) throw new Error(`Agents seed failed: ${agentsErr.message}`);
    console.log("✅ Created 2 Gemini Agents (Analyst -> Narrator)");

    // 3. Execute Workflow
    const input = "Next.js 16 and Gemini 1.5 are revolutionizing the way we build agentic AI applications with high-density UI.";
    console.log(`\n🏃 Running Workflow with input: "${input}"`);

    const result = await runWorkflow(workflow.id, input);
    console.log("\n🏁 Workflow completed successfully!");
    console.log(`Run ID: ${result.runId}`);

    // 4. Verify Logs from DB
    const { data: logs } = await supabaseAdmin
      .from("logs")
      .select("agent_id, status, output, agent:agents(name)")
      .eq("run_id", result.runId)
      .order("created_at", { ascending: true });

    console.log("\n📊 Trace Observability Report:");
    logs?.forEach((log, i) => {
      console.log(`[Step ${i+1}] [${(log.agent as any)?.name}] Status: ${log.status}`);
      console.log(`Result: ${log.output.trim().substring(0, 150)}...`);
    });

    console.log("\n🔗 View this trace in the Dashboard under /traces");

  } catch (error: any) {
    console.error("\n❌ Test Failed:", error.message);
    if (error.message.includes("403") || error.message.includes("404")) {
      console.log("💡 Tip: Check your SUPABASE_SERVICE_ROLE_KEY and verify the schema migration was applied.");
    }
  }
}

seedAndTestGemini();
