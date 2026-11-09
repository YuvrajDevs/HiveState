import type { GovernanceSettings, LogRecord, NewLog, NewRun, RunRecord, WorkflowRecord, Canvas } from "../engine/types";

/**
 * Persistence used by the engine and the API routes. The Supabase implementation is used in the app;
 * the in-memory one backs the unit tests. Keeping the engine behind this seam is what makes the
 * scheduling, retry and pause/resume logic testable without a database.
 */
export interface RunStore {
  getWorkflow(id: string): Promise<WorkflowRecord | null>;
  getSettings(): Promise<GovernanceSettings | null>;
  /** INR spent today (sum of step costs since local midnight in the database). */
  getTodaySpend(): Promise<number>;

  createRun(run: NewRun): Promise<RunRecord>;
  getRun(id: string): Promise<RunRecord | null>;
  updateRun(id: string, patch: Partial<RunRecord>): Promise<void>;

  insertLog(log: NewLog): Promise<LogRecord>;
  updateLog(id: string, patch: Partial<LogRecord>): Promise<void>;
  listLogs(runId: string): Promise<LogRecord[]>;
  findSuccessByFingerprint(fingerprint: string): Promise<LogRecord | null>;

  /** Saves a canvas and records a new immutable version when it changed. Returns the version number. */
  saveWorkflowCanvas(workflowId: string, canvas: Canvas, note?: string): Promise<number>;
}
