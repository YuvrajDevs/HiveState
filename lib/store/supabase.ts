import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { Canvas, LogRecord, NewLog, NewRun, RunRecord } from "../engine/types";
import type { RunStore } from "./types";

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements RunStore {
  private db = supabaseAdmin;

  async getWorkflow(id: string) {
    const res = await this.db.from("workflows").select("id, name, canvas_json, current_version").eq("id", id).maybeSingle();
    return check(res, "Load workflow");
  }

  async getSettings() {
    const res = await this.db.from("governance_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return check(res, "Load settings");
  }

  async getTodaySpend() {
    const res = await this.db.rpc("get_today_spend");
    return Number(check(res, "Load today's spend")) || 0;
  }

  async createRun(run: NewRun) {
    const res = await this.db.from("runs").insert(run).select().single();
    return check(res, "Create run") as RunRecord;
  }

  async getRun(id: string) {
    const res = await this.db.from("runs").select("*").eq("id", id).maybeSingle();
    return check(res, "Load run") as RunRecord | null;
  }

  async updateRun(id: string, patch: Partial<RunRecord>) {
    const res = await this.db.from("runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    check(res, "Update run");
  }

  async insertLog(log: NewLog) {
    const res = await this.db.from("logs").insert(log).select().single();
    return check(res, "Record step") as LogRecord;
  }

  async updateLog(id: string, patch: Partial<LogRecord>) {
    const res = await this.db.from("logs").update(patch).eq("id", id);
    check(res, "Update step");
  }

  async listLogs(runId: string) {
    const res = await this.db.from("logs").select("*").eq("run_id", runId).order("created_at", { ascending: true });
    return (check(res, "Load steps") || []) as LogRecord[];
  }

  async findSuccessByFingerprint(fingerprint: string) {
    const res = await this.db.from("logs").select("*").eq("fingerprint", fingerprint).eq("status", "success").limit(1).maybeSingle();
    return check(res, "Idempotency lookup") as LogRecord | null;
  }

  async saveWorkflowCanvas(workflowId: string, canvas: Canvas, note?: string) {
    // Done in one SQL function so concurrent saves cannot claim the same version number.
    const res = await this.db.rpc("save_workflow_version", { p_workflow_id: workflowId, p_canvas: canvas, p_note: note ?? null });
    return Number(check(res, "Save workflow"));
  }
}

let store: RunStore | null = null;
export function getStore(): RunStore {
  store ??= new SupabaseStore();
  return store;
}
