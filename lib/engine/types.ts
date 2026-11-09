/** Shapes shared by the engine, the store and the UI. Kept framework-free so they can be unit tested. */

export type RunStatus =
  | "queued"
  | "running"
  | "paused_hitl"
  | "paused_error"
  | "resumed"
  | "completed"
  | "aborted"
  | "failed"
  | "stopped";

export type LogStatus = "running" | "success" | "failed" | "paused_hitl" | "paused_error";

export interface CanvasNodeData {
  label?: string;
  systemPrompt?: string;
  model?: string;
  instructions?: string;
  /** Pause for human review before this agent runs. Older canvases stored this as the string "true". */
  is_hitl?: boolean | string;
  /** Extra attempts after the first one fails with a transient error. */
  retries?: number;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Expected answer length, used only by the cost estimate. */
  expectedOutputTokens?: number;
  [key: string]: unknown;
}

export interface CanvasNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id?: string;
  source: string;
  target: string;
}

export interface Canvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface WorkflowRecord {
  id: string;
  name: string;
  canvas_json: Canvas | null;
  current_version?: number | null;
}

export interface GovernanceSettings {
  daily_spend_limit?: number | null;
  context_optimization_enabled?: boolean | null;
  primary_model?: string | null;
  fallback_model?: string | null;
}

export interface RunRecord {
  id: string;
  workflow_id: string | null;
  status: RunStatus;
  input_prompt: string | null;
  variables?: Record<string, string> | null;
  /** Step inputs edited by a person before retrying, keyed by node id. */
  input_overrides?: Record<string, string> | null;
  context_summary?: string | null;
  consecutive_failures_count?: number | null;
  total_cost?: number | null;
  total_tokens?: number | null;
  total_duration_ms?: number | null;
  paused_node_id?: string | null;
  pause_reason?: string | null;
  workflow_version?: number | null;
  parent_run_id?: string | null;
  rerun_from_node_id?: string | null;
  error?: string | null;
  is_optimized?: boolean | null;
  circuit_breaker_triggered?: boolean | null;
  completed_at?: string | null;
  share_token?: string | null;
  started_at?: string;
}

export interface LogRecord {
  id: string;
  run_id: string;
  node_id: string;
  node_name?: string | null;
  input?: string | null;
  output?: string | null;
  status: LogStatus;
  error?: string | null;
  error_code?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  step_cost?: number | null;
  duration_ms?: number | null;
  system_prompt?: string | null;
  fingerprint?: string | null;
  model_used?: string | null;
  fallback_triggered?: boolean | null;
  correction_note?: string | null;
  is_skipped?: boolean | null;
  skip_reason?: string | null;
  attempts?: number | null;
  created_at?: string;
}

export type NewRun = Omit<Partial<RunRecord>, "id"> & { workflow_id: string; input_prompt: string };
export type NewLog = Omit<Partial<LogRecord>, "id"> & { run_id: string; node_id: string; status: LogStatus };
