// POST /api/verify  body: { original, translation, industry? }
// Compares a translation with its original and returns { faithful, issues }.
// Each issue has an impact: "meaning" (the reader could be misled) or
// "context" (only added background). Separate from /api/translate so it is
// opt-in and can use a stronger model.

import { buildVerifyRequest } from "./_prompts.js";
import { createHandler, validateVerifyBody, HttpError } from "./_security.js";
import { callClaude, parseModelJson } from "./_claude.js";

const ISSUE_TYPES = ["dropped", "softened", "strengthened", "added", "changed"];

export default createHandler({
  validate: validateVerifyBody,
  run: async function (data) {
    const out = parseModelJson(await callClaude(buildVerifyRequest(data)));
    if (out === null || typeof out !== "object" || Array.isArray(out)) {
      throw new HttpError(502, "Unexpected reply from the AI. Please try again.");
    }
    const str = (v) => (typeof v === "string" ? v : "");
    const issues = (Array.isArray(out.issues) ? out.issues : [])
      .filter((i) => i && typeof i === "object")
      .map((i) => ({
        type: ISSUE_TYPES.includes(i.type) ? i.type : "changed",
        // Anything not clearly marked "context" is treated as a meaning issue.
        impact: i.impact === "context" ? "context" : "meaning",
        original: str(i.original),
        translation: str(i.translation),
        detail: str(i.detail)
      }))
      // Meaning issues first.
      .sort((a, b) => (a.impact === b.impact ? 0 : a.impact === "meaning" ? -1 : 1));
    // Never report "faithful" when a meaning issue was found, whatever the model said.
    const faithful = out.faithful === true && !issues.some((i) => i.impact === "meaning");
    return { faithful, issues };
  }
});
