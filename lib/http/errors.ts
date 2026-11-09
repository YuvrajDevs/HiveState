import { NextResponse } from "next/server";
import { BudgetExceededError } from "@/lib/engine/engine";

/** Client errors carry their HTTP status; everything else is a 500 with a generic message logged server-side. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export function errorResponse(err: unknown, context: string) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message, ...err.details }, { status: err.status });
  if (err instanceof BudgetExceededError) return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
  console.error(`[api] ${context}:`, (err as Error)?.message);
  return NextResponse.json({ error: (err as Error)?.message || "Something went wrong" }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
}

/** Accepts only a flat string map, trimmed and bounded, for run variables. */
export function parseVariables(raw: unknown): Record<string, string> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "variables must be an object of strings.");
  const out: Record<string, string> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 50) throw new HttpError(400, "Too many variables (max 50).");
  for (const [k, v] of entries) {
    if (!/^[a-zA-Z_][\w.-]{0,63}$/.test(k)) throw new HttpError(400, `Invalid variable name: ${k}`);
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") throw new HttpError(400, `Variable ${k} must be text.`);
    const s = String(v);
    if (s.length > 20_000) throw new HttpError(400, `Variable ${k} is too long.`);
    out[k] = s;
  }
  return out;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
