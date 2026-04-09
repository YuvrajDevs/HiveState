import { supabaseAdmin } from "@/lib/supabase";
import { executeUnifiedModel } from "@/lib/models";
import crypto from "crypto";


/**
 * Executes a workflow using its interactive canvas structure.
 * Implements a dependency-aware parallel execution model.
 */
export async function runWorkflow(workflowId: string, input: string, runId?: string) {
  let currentRunId = runId;
  try {
    // 1. Fetch Workflow with its canvas_json
    const { data: workflow, error: wfErr } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (wfErr || !workflow) {
      throw new Error(`Workflow not found: ${wfErr?.message || "Invalid ID"}`);
    }

    if (!workflow.canvas_json) {
      throw new Error("Cannot execute workflow: No canvas design found. Open the editor first.");
    }

    const { nodes, edges } = workflow.canvas_json;
    if (!nodes || nodes.length === 0) {
      throw new Error("Cannot execute workflow: Empty canvas.");
    }

    // 2. Validate Graph for Cycles
    if (hasCycle(nodes, edges)) {
      throw new Error("Cannot execute workflow: Circular dependency detected in the graph.");
    }

    // 3. Resolve Execution dependencies
    const inDegreeMap = new Map<string, string[]>(); // nodeId -> list of parentIds
    nodes.forEach((n: any) => inDegreeMap.set(n.id, []));
    edges.forEach((e: any) => {
      const parents = inDegreeMap.get(e.target) || [];
      parents.push(e.source);
      inDegreeMap.set(e.target, parents);
    });

    const roots = nodes.filter((n: any) => (inDegreeMap.get(n.id) || []).length === 0);
    if (roots.length === 0) {
      throw new Error("Cannot execute workflow: No entry point found (no node without incoming edges).");
    }

    // 4. Setup or Resume Run Context
    const { data: settings } = await supabaseAdmin.from("governance_settings").select("*").single();
    const useOptimization = settings?.context_optimization_enabled || false;

    // Execution State
    const nodeOutputs = new Map<string, string>(); // nodeId -> last output
    const completedNodeIds = new Set<string>();
    let runTotalTokens = 0;
    let runTotalCost = 0;
    let runTotalDuration = 0;

    if (!currentRunId) {
      // Pre-run Budget Check
      const { data: todaySpend } = await supabaseAdmin.rpc('get_today_spend');
      const limit = settings?.daily_spend_limit || 0;
      
      if (limit > 0 && (Number(todaySpend) || 0) >= limit) {
        throw new Error(`Daily budget exceeded (Limit: ₹${limit}). Increase your budget in settings to continue.`);
      }

      const { data: newRun, error: runErr } = await supabaseAdmin
        .from("runs")
        .insert({
          workflow_id: workflowId,
          input_prompt: input,
          status: "running",
          is_optimized: useOptimization
        })
        .select()
        .single();
      
      if (runErr || !newRun) throw new Error(`Run creation failed: ${runErr?.message}`);
      currentRunId = newRun.id;

      // Implementation Phase 1: Context Summarization Node
      if (useOptimization && input && input.length > 500) {
        console.log("📝 Engine: Generating context summary for optimization...");
        try {
          const summaryOutcome = await executeUnifiedModel(
            "Summarize this content into a compact context header preserving key intent (20-50 tokens).",
            input,
            {}
          );
          await supabaseAdmin
            .from("runs")
            .update({ context_summary: summaryOutcome.text })
            .eq("id", currentRunId);
          
          // Total cost/tokens for the summarization step
          runTotalCost += (summaryOutcome.usageMetadata.promptTokenCount * 0.000005) + (summaryOutcome.usageMetadata.candidatesTokenCount * 0.000015);
          runTotalTokens += summaryOutcome.usageMetadata.totalTokenCount;
        } catch (sumErr) {
          console.warn("⚠️ Engine: Context summarization failed, proceeding with full input.", sumErr);
        }
      }
    } else {
      await supabaseAdmin
        .from("runs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", currentRunId);
    }



    // Check for already completed nodes (Resume logic)
    const { data: existingLogs } = await supabaseAdmin
      .from("logs")
      .select("node_id, output, total_tokens, step_cost, duration_ms, correction_note")
      .eq("run_id", currentRunId)
      .eq("status", "success");


    if (existingLogs) {
      existingLogs.forEach(log => {
        completedNodeIds.add(log.node_id);
        
        // If there's a correction note, append it to the output for downstream nodes
        let output = log.output;
        if (log.correction_note) {
          output = `${output}\n\n--- Human Feedback ---\n${log.correction_note}`;
        }
        
        nodeOutputs.set(log.node_id, output);
        runTotalTokens += log.total_tokens || 0;
        runTotalCost += Number(log.step_cost) || 0;
        runTotalDuration += log.duration_ms || 0;
      });
    }


    // 6. Execution Loop (Level-by-Level Parallelisms)
    while (completedNodeIds.size < nodes.length) {
      // Find nodes whose parents are all completed but they themselves are not
      const readyNodes = nodes.filter((node: any) => {
        if (completedNodeIds.has(node.id)) return false;
        const parents = inDegreeMap.get(node.id) || [];
        return parents.every(pId => completedNodeIds.has(pId));
      });

      if (readyNodes.length === 0) {
        const remaining = nodes.filter((n: any) => !completedNodeIds.has(n.id));
        if (remaining.length > 0) {
          throw new Error(`Execution stalled: ${remaining.length} nodes are unreachable.`);
        }
        break;
      }

      console.log(`🚀 Engine: Executing branch level (${readyNodes.length} nodes parallel)`);

      // HITL Check: If any ready node is HITL or has is_hitl flag, we pause before executing it
      const hitlNode = readyNodes.find((n: any) => n.type === "HITLNode" || n.data?.is_hitl);
      if (hitlNode) {
        console.log(`⏸️ Engine: HITL Pause at ${hitlNode.data?.label || "Manual Review"}`);
        
        // Aggregate input for the HITL node to store it for review
        const { data: latestRun } = await supabaseAdmin.from("runs").select("context_summary").eq("id", currentRunId!).single();
        const activeInput = latestRun?.context_summary || input;

        const parents = inDegreeMap.get(hitlNode.id) || [];
        let nodeInput = "";
        if (parents.length === 0) {
          nodeInput = activeInput;
        } else if (parents.length === 1) {
          nodeInput = nodeOutputs.get(parents[0]) || "";
        } else {
          // Structured JSON input for multi-parent nodes
          const inputs = parents.map((pId: string) => {
            const pNode = nodes.find((n: any) => n.id === pId);
            return {
              source_node: pNode?.data?.label || "Previous Agent",
              content: nodeOutputs.get(pId) || ""
            };
          });
          nodeInput = JSON.stringify({ inputs });
        }

        // Create a log entry for the HITL node to store the input payload
        await supabaseAdmin
          .from("logs")
          .upsert({
            run_id: currentRunId!,
            node_id: hitlNode.id,
            node_name: hitlNode.data?.label || "Manual Review",
            input: nodeInput,
            status: "paused_hitl",
            created_at: new Date().toISOString()
          }, { onConflict: 'run_id,node_id' });

        await supabaseAdmin
          .from("runs")
          .update({ 
            status: "paused_hitl", 
            pause_reason: "hitl",
            paused_node_id: hitlNode.id,
            updated_at: new Date().toISOString(),
            total_cost: runTotalCost,
            total_tokens: runTotalTokens,
            total_duration_ms: runTotalDuration
          })
          .eq("id", currentRunId);
        
        return { runId: currentRunId, status: "paused_hitl", pausedNodeId: hitlNode.id };
      }


      // Execute ready nodes in parallel
      const results = await Promise.all(readyNodes.map(async (node: any) => {
        const parents = inDegreeMap.get(node.id) || [];
        const { data: latestRun } = await supabaseAdmin.from("runs").select("context_summary").eq("id", currentRunId!).single();
        const activeInput = latestRun?.context_summary || input;
        
        // Aggregate input from parents
        let nodeInput = "";
        if (parents.length === 0) {
          nodeInput = activeInput;
        } else if (parents.length === 1) {
          nodeInput = nodeOutputs.get(parents[0]) || "";
        } else {
          // Structured JSON input for multi-parent nodes
          const inputs = parents.map((pId: string) => {
            const pNode = nodes.find((n: any) => n.id === pId);
            return {
              source_node: pNode?.data?.label || "Previous Agent",
              content: nodeOutputs.get(pId) || ""
            };
          });
          nodeInput = JSON.stringify({ inputs });
        }

        console.log(`🤖 Engine: Executing ${node.data.label} (Node: ${node.id})...`);
        
        // --- IDEMPOTENCY CHECK ---
        const fingerprint = generateFingerprint(currentRunId!, node.id, nodeInput, node.data.systemPrompt);
        const { data: existingSuccess } = await supabaseAdmin
          .from("logs")
          .select("*")
          .eq("fingerprint", fingerprint)
          .eq("status", "success")
          .maybeSingle();

        if (existingSuccess) {
          console.log(`♻️  Engine: Idempotent Reuse for ${node.data.label}`);
          // Log the skip
          await supabaseAdmin.from("logs").insert({
            run_id: currentRunId!,
            node_id: node.id,
            node_name: node.data.label,
            input: nodeInput,
            output: existingSuccess.output,
            status: "success",
            is_skipped: true,
            skip_reason: "idempotent reuse",
            fingerprint: fingerprint,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            step_cost: 0,
            duration_ms: 0,
            system_prompt: node.data.systemPrompt
          });

          return { 
            id: node.id, 
            output: existingSuccess.output, 
            cost: 0, 
            tokens: 0, 
            duration: 0,
            status: "success"
          };
        }
        // -------------------------

        const outcome = await executeNodeStep(currentRunId!, node, nodeInput, fingerprint);

        
        return { 
          id: node.id, 
          output: outcome.output, 
          cost: outcome.cost, 
          tokens: outcome.totalTokens, 
          duration: outcome.durationMs,
          status: outcome.status,
          error: outcome.error 
        };
      }));

      // Check for errors in the level
      const failedResult = results.find(r => r.status === "failed");
      if (failedResult) {
        console.log(`⚠️ Engine: Node Failure detected. Pausing run.`);
        
        // Increment failure count
        const { data: runData } = await supabaseAdmin.from("runs").select("consecutive_failures_count").eq("id", currentRunId).single();
        const newCount = (runData?.consecutive_failures_count || 0) + 1;
        const isBroken = newCount >= 3;

        await supabaseAdmin
          .from("runs")
          .update({ 
            status: "paused_error", 
            pause_reason: isBroken ? "circuit_breaker" : "error",
            paused_node_id: failedResult.id,
            updated_at: new Date().toISOString(),
            total_cost: runTotalCost,
            total_tokens: runTotalTokens,
            total_duration_ms: runTotalDuration,
            consecutive_failures_count: newCount,
            circuit_breaker_triggered: isBroken
          })
          .eq("id", currentRunId);
        
        return { 
          runId: currentRunId, 
          status: "paused_error", 
          failedNodeId: failedResult.id,
          circuitBreakerTriggered: isBroken 
        };
      }

      // Reset failure count on successful level
      await supabaseAdmin.from("runs").update({ consecutive_failures_count: 0 }).eq("id", currentRunId);

      // Runtime Budget Enforcement
      const { data: todaySpendAfter } = await supabaseAdmin.rpc('get_today_spend');
      const currentLimit = settings?.daily_spend_limit || 0;
      if (currentLimit > 0 && (Number(todaySpendAfter) || 0) >= currentLimit) {
        console.warn(`🛑 Engine: Daily budget reached mid-run. Pausing.`);
        await supabaseAdmin.from("runs").update({
          status: "paused_error",
          pause_reason: "budget_limit",
          updated_at: new Date().toISOString(),
          total_cost: runTotalCost,
          total_tokens: runTotalTokens,
          total_duration_ms: runTotalDuration
        }).eq("id", currentRunId);

        return { runId: currentRunId, status: "paused_error", error: "Daily budget limit reached." };
      }

      // Update state after the parallel level finishes
      results.forEach(res => {
        nodeOutputs.set(res.id, res.output!);
        completedNodeIds.add(res.id);
        runTotalCost += res.cost!;
        runTotalTokens += res.tokens!;
        runTotalDuration += res.duration!;
      });
    }

    // 7. Finalize Run
    await supabaseAdmin
      .from("runs")
      .update({ 
        status: "completed", 
        paused_node_id: null,
        updated_at: new Date().toISOString(),
        total_cost: runTotalCost,
        total_tokens: runTotalTokens,
        total_duration_ms: runTotalDuration,
        completed_at: new Date().toISOString()
      })
      .eq("id", currentRunId);

    console.log("🏁 Workflow Execution: ALL NODES PROCESSED");
    return { runId: currentRunId, status: "completed" };

  } catch (error: any) {
    console.error("⛔ Workflow Engine Fatal Error:", error.message);
    if (currentRunId) {
      await supabaseAdmin
        .from("runs")
        .update({ 
          status: "failed", 
          updated_at: new Date().toISOString()
        })
        .eq("id", currentRunId);
    }
    throw error;
  }
}

/**
 * Resumes a workflow from a paused state.
 */
export async function resumeWorkflow(runId: string, nodeId?: string, editedInput?: string) {
  // 1. Fetch Run and Workflow
  const { data: run, error: runError } = await supabaseAdmin
    .from("runs")
    .select("*, workflow:workflows(*)")
    .eq("id", runId)
    .single();

  if (runError || !run) throw new Error("Run not found.");

  // If node input was edited, update the most recent log for that node or prep for it
  if (nodeId && editedInput !== undefined) {
    console.log(`📝 Engine: Resume with edited input for node ${nodeId}`);
    // We don't necessarily update the log yet, runWorkflow will handle re-execution
    // But we might want to log that an edit happened
  }

  // Set status to resumed then call runWorkflow
  await supabaseAdmin
    .from("runs")
    .update({ status: "resumed", updated_at: new Date().toISOString() })
    .eq("id", runId);

  return runWorkflow(run.workflow_id, run.input_prompt, runId);
}

/**
 * DFS-based cycle detection for visual graph.
 */
function hasCycle(nodes: any[], edges: any[]): boolean {
  const adj = new Map<string, string[]>();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => adj.get(e.source)?.push(e.target));

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function isCyclic(id: string): boolean {
    if (recStack.has(id)) return true;
    if (visited.has(id)) return false;

    visited.add(id);
    recStack.add(id);

    const neighbors = adj.get(id) || [];
    for (const neighbor of neighbors) {
      if (isCyclic(neighbor)) return true;
    }

    recStack.delete(id);
    return false;
  }

  for (const node of nodes) {
    if (isCyclic(node.id)) return true;
  }
  return false;
}

/**
 * Atomic execution of a single node using Gemini.
 */
async function executeNodeStep(runId: string, node: any, input: string, fingerprint?: string) {

  const nodeLabel = node.data.label || "Untitled Agent";
  const systemPrompt = node.data.systemPrompt || "You are a helpful assistant.";
  const model = node.data.model || "gemini-2.5-flash";
  const startTime = performance.now();

  try {
    // Strategy for multi-input nodes: inject guidance if input is JSON
    let activeSystemPrompt = systemPrompt;
    if (input.startsWith('{"inputs":')) {
      activeSystemPrompt = `You will receive multiple inputs from different agents in a structured JSON format. Each input is labeled with its source. Combine them intelligently into a coherent output.\n\n${systemPrompt}`;
    }

    const outcome = await executeUnifiedModel(
      activeSystemPrompt,
      input,
      { primaryModel: model }
    );

    const output = outcome.text;
    const usage = outcome.usageMetadata;
    const durationMs = Math.round(performance.now() - startTime);

    const promptTokens = usage?.promptTokenCount || 0;
    const compTokens = usage?.candidatesTokenCount || 0;
    const totalTokens = usage?.totalTokenCount || 0;

    // Correct Cost formulas based on INR for Gemini 2.5 Flash
    // Scale: ₹5 per 1M prompt tokens, ₹15 per 1M completion tokens
    const cost = (promptTokens * 0.000005) + (compTokens * 0.000015);

    // Commit state
    const { error: logErr } = await supabaseAdmin
      .from("logs")
      .insert({
        run_id: runId,
        node_id: node.id,
        node_name: nodeLabel,
        input: input,
        output: output,
        status: "success",
        prompt_tokens: promptTokens,
        completion_tokens: compTokens,
        total_tokens: totalTokens,
        step_cost: cost,
        duration_ms: durationMs,
        system_prompt: systemPrompt,
        fingerprint: fingerprint,
        model_used: outcome.modelUsed,
        fallback_triggered: outcome.isFallback
      });


    if (logErr) throw new Error(`State Commit Failed: ${logErr.message}`);

    return { output, cost, totalTokens, durationMs, status: "success" };

  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    await supabaseAdmin
      .from("logs")
      .insert({
        run_id: runId,
        node_id: node.id,
        node_name: nodeLabel,
        input: input,
        status: "failed",
        error: err.message,
        error_code: err.code || "UNKNOWN_ERROR",
        duration_ms: durationMs,
        system_prompt: systemPrompt,
        fingerprint: fingerprint
      });


    return { status: "failed", error: err.message, cost: 0, totalTokens: 0, durationMs };
  }
}

/**
 * Generates a deterministic hash for node execution.
 */
function generateFingerprint(runId: string, nodeId: string, input: string, systemPrompt: string): string {
  const payload = `${runId}:${nodeId}:${input}:${systemPrompt}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

