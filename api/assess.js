// POST /api/assess  body: { framework, env, family, input }
// Runs the main assessment on Haiku. Protections are described in api/_security.js.

import { buildAssessRequest } from "./_prompts.js";
import { createHandler, validateAssessBody, HttpError } from "./_security.js";
import { callClaude, parseModelJson } from "./_claude.js";

export default createHandler({
  validate: validateAssessBody,
  run: async function(data) {
    var result = parseModelJson(await callClaude(buildAssessRequest(data)));
    if (result === null || typeof result !== "object" || Array.isArray(result)) {
      throw new HttpError(502, "Unexpected JSON from the AI. Please try again.");
    }
    return { result };
  }
});
