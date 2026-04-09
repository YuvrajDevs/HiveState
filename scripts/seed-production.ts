import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("🚀 Initializing Production Seed Process...");

  // 1. Ensure Columns
  // (We assume columns exist if migrations were run, but we can check indirectly)
  
  // 2. Clear existing templates to avoid duplicates during re-seed
  await supabase.from("workflows").delete().eq("is_template", true);

  // 3. High-Quality Templates
  const templates = [
    {
      name: "Strategic Research",
      is_template: true,
      template_name: "Deep Research & Synthesis",
      template_description: "Multi-agent research pipeline for deep fact-gathering and executive summary generation.",
      canvas_json: {
        nodes: [
          { id: "n1", type: "AgentNode", data: { label: "Researcher", systemPrompt: "Gather technical data.", model: "gemini-2.0-flash" }, position: { x: 0, y: 0 } },
          { id: "n2", type: "AgentNode", data: { label: "Synthesizer", systemPrompt: "Summarize findings.", model: "gemini-2.0-flash" }, position: { x: 300, y: 0 } }
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }]
      }
    },
    {
      name: "Security Auditor",
      is_template: true,
      template_name: "Code Security Audit",
      template_description: "Analyze codebases for vulnerabilities, secrets, and architectural risks.",
      canvas_json: {
        nodes: [
          { id: "s1", type: "AgentNode", data: { label: "Bug Hunter", systemPrompt: "Find logic bugs.", model: "gemini-2.0-flash" }, position: { x: 0, y: 0 } },
          { id: "s2", type: "AgentNode", data: { label: "Sec Expert", systemPrompt: "Find security risks.", model: "gemini-2.0-flash" }, position: { x: 300, y: 0 } }
        ],
        edges: [{ id: "es1", source: "s1", target: "s2" }]
      }
    }
  ];

  const { error } = await supabase.from("workflows").insert(templates);
  
  if (error) {
    console.error("❌ Seeding Failed:", error.message);
  } else {
    console.log("✅ Production Templates Seeded Successfully.");
  }

  // 4. Governance Defaults
  await supabase.from("governance_settings").upsert({
    id: "00000000-0000-0000-0000-000000000000",
    primary_model: "gemini-2.0-flash",
    fallback_model: "gemini-1.5-flash",
    daily_spend_limit: 100,
    context_optimization_enabled: true
  });
  console.log("✅ Governance Settings Initialized.");
}

seed();
