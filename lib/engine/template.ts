import type { Canvas } from "./types";

/** `{{ name }}` placeholders in prompts and run input. Names: letters, digits, underscore, dash, dot. */
const VAR_RE = /\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}/g;

export function extractVariables(text: string | null | undefined): string[] {
  if (!text) return [];
  const names = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) names.add(m[1]);
  return [...names];
}

/** Variables used anywhere in a workflow's prompts, in first-seen order. */
export function workflowVariables(canvas: Canvas | null | undefined): string[] {
  const names = new Set<string>();
  for (const n of canvas?.nodes || []) {
    for (const field of [n.data?.systemPrompt, n.data?.instructions]) {
      extractVariables(typeof field === "string" ? field : "").forEach((v) => names.add(v));
    }
  }
  return [...names];
}

/** Replaces known placeholders. Unknown ones are left untouched so a typo is visible in the trace. */
export function renderTemplate(text: string, vars: Record<string, string> | null | undefined): string {
  if (!text || !vars) return text;
  return text.replace(VAR_RE, (whole, name: string) => (Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole));
}

export function missingVariables(required: string[], vars: Record<string, string> | null | undefined): string[] {
  return required.filter((name) => !vars || vars[name] === undefined || String(vars[name]).trim() === "");
}
