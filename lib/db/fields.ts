/** Column lists shared by the run detail page and its polling endpoints. */
export const RUN_FIELDS = `id, status, workflow_id, input_prompt, started_at, updated_at, completed_at, total_cost, total_tokens,
  total_duration_ms, paused_node_id, pause_reason, error, variables, share_token, parent_run_id, rerun_from_node_id,
  workflow_version, consecutive_failures_count, circuit_breaker_triggered, workflow:workflows(id, name, canvas_json)`;

export const LOG_FIELDS = `id, node_id, node_name, input, output, system_prompt, status, error, error_code, created_at, prompt_tokens,
  completion_tokens, total_tokens, step_cost, duration_ms, model_used, fallback_triggered, attempts, is_skipped, skip_reason, correction_note`;
