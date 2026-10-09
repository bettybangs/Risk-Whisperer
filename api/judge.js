// POST /api/judge  body: { framework, input, controlMappings }
// Opus 5 checks each mapped control against verified summaries of the AICPA
// 2017 Trust Services Criteria and returns one judgment per control. The app
// keeps the original mappings if this call fails. Protections are described
// in api/_security.js.

import { buildJudgeRequest, selectControlsToJudge, isVerifiedControl } from "./_prompts.js";
import { createHandler, validateJudgeBody, HttpError } from "./_security.js";
import { callClaude, parseModelJson } from "./_claude.js";

export default createHandler({
  validate: validateJudgeBody,
  run: async function({ framework, input, controlMappings }) {
    var controls = selectControlsToJudge(framework, controlMappings);
    if (controls.length === 0) return { judgments: [] };

    var grounded = parseModelJson(await callClaude(buildJudgeRequest({ input, controls })));
    if (!Array.isArray(grounded)) throw new HttpError(502, "Unexpected JSON from the AI. Please try again.");

    var judgedIds = controls.map(function(c) { return c.id; });
    var judgments = grounded
      .filter(function(g) {
        return g && typeof g === "object" && judgedIds.indexOf(String(g.id)) !== -1 && typeof g.rationale === "string";
      })
      .map(function(g) {
        var id = String(g.id);
        return {
          id: id,
          relevant: g.relevant !== false,
          rationale: g.rationale,
          // Only controls with a verified AICPA definition may have their
          // rationale replaced; the server decides, not the model.
          verified: isVerifiedControl(id)
        };
      });
    return { judgments };
  }
});
