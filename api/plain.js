// POST /api/plain  body: { result }
// Rewrites an assessment in plain business language on Haiku. Protections are
// described in api/_security.js.

import { buildPlainRequest } from "./_prompts.js";
import { createHandler, validatePlainBody, HttpError } from "./_security.js";
import { callClaude, parseModelJson } from "./_claude.js";

export default createHandler({
  validate: validatePlainBody,
  run: async function(data) {
    var plain = parseModelJson(await callClaude(buildPlainRequest(data)));
    if (plain === null || typeof plain !== "object" || Array.isArray(plain)) {
      throw new HttpError(502, "Unexpected JSON from the AI. Please try again.");
    }
    return { plain };
  }
});
