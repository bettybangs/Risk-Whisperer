// POST /api/verify  body: { original, translation }
// Compares a translation with its original and returns { faithful, issues }.
// Separate from /api/translate so it is opt-in and can use a stronger model.

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
        original: str(i.original),
        translation: str(i.translation),
        detail: str(i.detail)
      }));
    // Never report "faithful" when issues were found, whatever the model said.
    return { faithful: out.faithful === true && issues.length === 0, issues };
  }
});
