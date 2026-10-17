// POST /api/assess  body: { framework, env, family, input }
// Runs the main assessment on Haiku. Protections are described in api/_security.js.

import { buildAssessRequest } from "./_prompts.js";
import { createHandler, validateAssessBody, HttpError } from "./_security.js";
import { callClaude, parseModelJson } from "./_claude.js";
import { validateControls } from "./_validateControls.js";
import { stripLeakedPhrases } from "./_leakFilter.js";

export default createHandler({
  validate: validateAssessBody,
  run: async function(data) {
    var result = stripLeakedPhrases(parseModelJson(await callClaude(buildAssessRequest(data))));
    if (result === null || typeof result !== "object" || Array.isArray(result)) {
      throw new HttpError(502, "Unexpected JSON from the AI. Please try again.");
    }
    // Check the returned control IDs against the framework's verified list.
    // Set by the server after parsing, so a "validation" key in the model's
    // own output is overwritten. Control mappings are reported on, not changed.
    result.validation = validateControls(data.framework, result.controlMappings);
    return { result };
  }
});
