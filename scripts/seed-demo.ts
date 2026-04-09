import { supabaseAdmin } from "../lib/supabase";

async function seed() {
  console.log("🚀 Starting seeding...");

  // 1. Create the Demo Workflow
  const { data: workflow, error: wfError } = await supabaseAdmin
    .from("workflows")
    .upsert({
      id: "00000000-0000-4000-a000-000000000001", 
      name: "Automated Security Audit",
      canvas_json: {
        nodes: [
          { id: "sec_1", data: { label: "Vulnerability Scanner", systemPrompt: "You are a specialized security scanner. Analyze the provided codebase or URL for common vulnerabilities like SQL Injection, XSS, and hardcoded secrets. Provide a structured list of findings.", model: "gemini-2.5-flash" } },
          { id: "sec_2", data: { label: "API Security Expert", systemPrompt: "You are an API security expert. Review the identified vulnerabilities and focus specifically on API-related risks such as BOLA, lack of rate limiting, and insecure tokens.", model: "gemini-2.5-flash" } },
          { id: "sec_3", data: { label: "Threat Modeling Agent", systemPrompt: "You are a threat modeling specialist. Perform a STRIDE analysis on the security findings to categorize risks and identify potential attack vectors.", model: "gemini-2.5-flash" } },
          { id: "sec_4", data: { label: "Remediation Planner", systemPrompt: "You are a senior security engineer. Consolidate all findings and threats into a prioritized remediation plan with clear, actionable steps for developers.", model: "gemini-2.5-flash" } }
        ],
        edges: [
          { id: "e1-2", source: "sec_1", target: "sec_2" },
          { id: "e2-3", source: "sec_2", target: "sec_3" },
          { id: "e3-4", source: "sec_3", target: "sec_4" }
        ]
      }
    })
    .select()
    .single();

  if (wfError) {
    console.error("❌ Workflow seeding failed:", wfError);
    return;
  }
  console.log("✅ Workflow seeded:", workflow.id);

  // 2. Create a Sample Completed Task (Run)
  const { data: run, error: runError } = await supabaseAdmin
    .from("runs")
    .upsert({
      id: "11111111-1111-4111-a111-111111111111",
      workflow_id: workflow.id,
      status: "completed",
      input_prompt: "Audit the HiveState core authentication module (v1.0.0-beta).",
      total_cost: 0.012450,
      total_tokens: 8420,
      total_duration_ms: 14500,
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 55 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (runError) {
    console.error("❌ Run seeding failed:", runError);
    return;
  }
  console.log("✅ Run seeded:", run.id);

  // 3. Create Logs for the Sample Task
  // Delete existing logs for this run first
  await supabaseAdmin.from("logs").delete().eq("run_id", run.id);

  const logs = [
    {
      run_id: run.id,
      node_id: "sec_1",
      node_name: "Vulnerability Scanner",
      status: "success",
      input: "Audit the HiveState core authentication module (v1.0.0-beta).",
      output: "SCAN RESULTS:\n- High Risk: Potential SQL connection string exposed in config/auth.js line 42.\n- Medium Risk: Lack of input validation on login user_id parameter.\n- Low Risk: Error messages reveal server version information.",
      prompt_tokens: 1200, completion_tokens: 450, total_tokens: 1650, step_cost: 0.002400, duration_ms: 3200,
      system_prompt: "You are a specialized security scanner. Analyze the provided codebase or URL for common vulnerabilities like SQL Injection, XSS, and hardcoded secrets. Provide a structured list of findings."
    },
    {
      run_id: run.id,
      node_id: "sec_2",
      node_name: "API Security Expert",
      status: "success",
      input: "SCAN RESULTS:\n- High Risk: Potential SQL connection string exposed in config/auth.js line 42.\n- Medium Risk: Lack of input validation on login user_id parameter.\n- Low Risk: Error messages reveal server version information.",
      output: "API AUDIT:\n- Confirmed: auth.js exposure is critical for the /api/login endpoint.\n- Added Risk: session tokens use weak hashing algorithm (MD5).\n- Added Risk: No rate limiting on /api/verify.",
      prompt_tokens: 1650, completion_tokens: 600, total_tokens: 2250, step_cost: 0.003300, duration_ms: 4100,
      system_prompt: "You are an API security expert. Review the identified vulnerabilities and focus specifically on API-related risks such as BOLA, lack of rate limiting, and insecure tokens."
    },
    {
      run_id: run.id,
      node_id: "sec_3",
      node_name: "Threat Modeling Agent",
      status: "success",
      input: "API AUDIT:\n- Confirmed: auth.js exposure is critical for the /api/login endpoint.\n- Added Risk: session tokens use weak hashing algorithm (MD5).\n- Added Risk: No rate limiting on /api/verify.",
      output: "THREAT MODEL (STRIDE):\n- Information Disclosure: Hardcoded credentials (Line 42).\n- Tampering: Weak session tokens (MD5).\n- Denial of Service: Lack of rate limiting on API endpoints.",
      prompt_tokens: 2250, completion_tokens: 800, total_tokens: 3050, step_cost: 0.004500, duration_ms: 3800,
      system_prompt: "You are a threat modeling specialist. Perform a STRIDE analysis on the security findings to categorize risks and identify potential attack vectors."
    },
    {
      run_id: run.id,
      node_id: "sec_4",
      node_name: "Remediation Planner",
      status: "success",
      input: "THREAT MODEL (STRIDE):\n- Information Disclosure: Hardcoded credentials (Line 42).\n- Tampering: Weak session tokens (MD5).\n- Denial of Service: Lack of rate limiting on API endpoints.",
      output: "REMEDIATION PLAN:\n1. IMMEDIATE: Move hardcoded credentials to Environment Variables using .env.\n2. HIGH: Upgrade session hashing to Argon2 or bcrypt.\n3. HIGH: Implement redis-based rate limiting on all public API routes.\n4. MEDIUM: Sanitize all user input before processing login queries.",
      prompt_tokens: 1050, completion_tokens: 420, total_tokens: 1470, step_cost: 0.002250, duration_ms: 3400,
      system_prompt: "You are a senior security engineer. Consolidate all findings and threats into a prioritized remediation plan with clear, actionable steps for developers."
    }
  ];

  const { error: logsError } = await supabaseAdmin.from("logs").insert(logs as any);

  if (logsError) {
    console.error("❌ Logs seeding failed:", logsError);
  } else {
    console.log("✅ Logs seeded successfully.");
  }
}

seed();
