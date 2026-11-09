import { describe, expect, it } from "vitest";
import { extractVariables, missingVariables, renderTemplate, workflowVariables } from "@/lib/engine/template";
import { agent, canvas } from "../helpers";

describe("templates", () => {
  it("extracts unique variable names", () => {
    expect(extractVariables("Hi {{ name }}, {{name}} from {{team.lead}} and {{ 1bad }}")).toEqual(["name", "team.lead"]);
  });

  it("renders known variables and leaves unknown ones visible", () => {
    expect(renderTemplate("{{a}} and {{ b }} and {{c}}", { a: "1", b: "2" })).toBe("1 and 2 and {{c}}");
  });

  it("does not treat inherited object keys as variables", () => {
    expect(renderTemplate("{{toString}}", {})).toBe("{{toString}}");
  });

  it("collects variables across a workflow and reports missing ones", () => {
    const c = canvas([agent("a", { systemPrompt: "For {{company}}" }), agent("r", { instructions: "Check {{owner}}" }, "HITLNode")], []);
    expect(workflowVariables(c)).toEqual(["company", "owner"]);
    expect(missingVariables(["company", "owner"], { company: "Acme", owner: " " })).toEqual(["owner"]);
  });
});
