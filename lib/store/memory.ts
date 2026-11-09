import crypto from "crypto";
import type { Canvas, GovernanceSettings, LogRecord, NewLog, NewRun, RunRecord, WorkflowRecord } from "../engine/types";
import type { RunStore } from "./types";

/** In-memory RunStore for tests and local experiments. Mirrors the Supabase behaviour closely. */
export class MemoryStore implements RunStore {
  workflows = new Map<string, WorkflowRecord>();
  versions: Array<{ workflow_id: string; version: number; canvas_json: Canvas; note?: string }> = [];
  runs = new Map<string, RunRecord>();
  logs: LogRecord[] = [];
  settings: GovernanceSettings = { daily_spend_limit: 0, context_optimization_enabled: false };
  /** Spend that happened before the test started. */
  baseSpend = 0;

  addWorkflow(wf: Omit<WorkflowRecord, "current_version"> & { current_version?: number }) {
    this.workflows.set(wf.id, { current_version: 0, ...wf });
    return wf.id;
  }

  async getWorkflow(id: string) {
    return this.workflows.get(id) ?? null;
  }
  async getSettings() {
    return this.settings;
  }
  async getTodaySpend() {
    return this.baseSpend + this.logs.reduce((s, l) => s + (Number(l.step_cost) || 0), 0);
  }
  async createRun(run: NewRun) {
    const rec: RunRecord = {
      status: "running",
      consecutive_failures_count: 0,
      total_cost: 0,
      total_tokens: 0,
      total_duration_ms: 0,
      variables: {},
      started_at: new Date().toISOString(),
      ...run,
      id: crypto.randomUUID(),
    } as RunRecord;
    this.runs.set(rec.id, rec);
    return { ...rec };
  }
  async getRun(id: string) {
    const r = this.runs.get(id);
    return r ? { ...r } : null;
  }
  async updateRun(id: string, patch: Partial<RunRecord>) {
    const r = this.runs.get(id);
    if (r) this.runs.set(id, { ...r, ...patch });
  }
  async insertLog(log: NewLog) {
    const rec = { created_at: new Date().toISOString(), ...log, id: crypto.randomUUID() } as LogRecord;
    this.logs.push(rec);
    return { ...rec };
  }
  async updateLog(id: string, patch: Partial<LogRecord>) {
    const i = this.logs.findIndex((l) => l.id === id);
    if (i >= 0) this.logs[i] = { ...this.logs[i], ...patch };
  }
  async listLogs(runId: string) {
    return this.logs.filter((l) => l.run_id === runId).map((l) => ({ ...l }));
  }
  async findSuccessByFingerprint(fingerprint: string) {
    return this.logs.find((l) => l.fingerprint === fingerprint && l.status === "success") ?? null;
  }
  async saveWorkflowCanvas(workflowId: string, canvas: Canvas, note?: string) {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error("Workflow not found");
    const latest = this.versions.filter((v) => v.workflow_id === workflowId).at(-1);
    if (latest && JSON.stringify(latest.canvas_json) === JSON.stringify(canvas)) {
      wf.canvas_json = canvas;
      return latest.version;
    }
    const version = (latest?.version || 0) + 1;
    this.versions.push({ workflow_id: workflowId, version, canvas_json: canvas, note });
    wf.canvas_json = canvas;
    wf.current_version = version;
    return version;
  }
}
