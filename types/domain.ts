/**
 * Shapes of HiveState's data as the app uses it (Supabase rows plus the React Flow canvas).
 * Columns are optional where a query selects only some of them.
 */

/**
 * A joined row. PostgREST returns a to-one relation as an object, but supabase-js without generated
 * types infers an array, so accept both and read it with one().
 */
export type Related<T> = T | T[] | null | undefined;
export const one = <T,>(r: Related<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : (r ?? null));

export type RunStatus = "running" | "paused_hitl" | "paused_error" | "resumed" | "completed" | "aborted" | "failed" | "stopped";
export type LogStatus = "success" | "failed" | "paused_hitl" | "paused_error";

export interface AgentNodeData {
  label?: string;
  name?: string;
  model?: string;
  systemPrompt?: string;
  instructions?: string;
  is_hitl?: boolean;
  status?: string;
  [key: string]: unknown;
}

/** Node data on the editor canvas while a run is shown: the saved fields plus that run's state for the node. */
export interface CanvasNodeData extends AgentNodeData {
  pause_reason?: string | null;
  executionLog?: Log;
  isInspecting?: boolean;
  onInspect?: (type: "input" | "output") => void;
  onRetry?: () => void | Promise<void>;
  runId?: string | null;
}

export interface CanvasNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: AgentNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

export interface Canvas {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  /** Stats added by the dashboard and workflow list */
  nodeCount?: number;
  successRate?: number;
  totalRuns?: number;
  lastRunTime?: string | null;
  created_at?: string;
  is_template?: boolean;
  canvas_json?: Canvas | string | null;
  template_name?: string | null;
  template_description?: string | null;
}

export interface Run {
  id: string;
  workflow_id: string;
  status: RunStatus;
  input_prompt?: string | null;
  started_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
  total_cost?: number | null;
  total_tokens?: number | null;
  total_duration_ms?: number | null;
  pause_reason?: string | null;
  paused_node_id?: string | null;
  error?: string | null;
  circuit_breaker_triggered?: boolean | null;
  consecutive_failures_count?: number | null;
  tokens_saved?: number | null;
  is_optimized?: boolean | null;
  workflow?: Related<Partial<Pick<Workflow, "id" | "name" | "canvas_json">>>;
  /** Set by the running-tasks API: completed steps over total. */
  progress?: number;
  budget_limit?: number | null;
}

export interface Log {
  id: string;
  run_id?: string;
  agent_id?: string | null;
  node_id?: string | null;
  node_name?: string | null;
  status: LogStatus;
  input?: string | null;
  output?: string | null;
  error?: string | null;
  error_code?: string | null;
  created_at: string;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  step_cost?: number | null;
  duration_ms?: number | null;
  model_used?: string | null;
  system_prompt?: string | null;
  input_payload?: string | null;
  pause_reason?: string | null;
  correction_note?: string | null;
  fallback_triggered?: boolean | null;
  is_skipped?: boolean | null;
  skip_reason?: string | null;
  agent?: Related<{ name?: string; workflow?: Related<Pick<Workflow, "id" | "name">> }>;
  run?: Related<{ status?: RunStatus; workflow?: Related<Pick<Workflow, "id" | "name">> }>;
}

/** Parse a stored canvas, which older rows keep as a JSON string. */
export function parseCanvas(raw: Workflow["canvas_json"]): Canvas {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Canvas;
    } catch {
      return {};
    }
  }
  return raw;
}

export interface GovernanceSettings {
  id?: string;
  daily_spend_limit: number;
  context_optimization_enabled: boolean;
  primary_model: string;
  fallback_model: string;
  updated_at?: string;
}
