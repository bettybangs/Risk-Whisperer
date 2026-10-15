// POST /api/translate  body: { text, audience, mode, length }
// Returns { summary, plain, glossary, flags }.

import { buildTranslateRequest } from "./_prompts.js";
import { createHandler, validateTranslateBody, HttpError } from "./_security.js";
import { callClaude, parseModelJson } from "./_claude.js";

function asStringArray(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export default createHandler({
  validate: validateTranslateBody,
  run: async function (data) {
    const out = parseModelJson(await callClaude(buildTranslateRequest(data)));
    if (out === null || typeof out !== "object" || Array.isArray(out)) {
      throw new HttpError(502, "Unexpected reply from the AI. Please try again.");
    }
    return {
      summary: typeof out.summary === "string" ? out.summary : "",
      plain: typeof out.plain === "string" ? out.plain : "",
      glossary: (Array.isArray(out.glossary) ? out.glossary : [])
        .filter((g) => g && typeof g.term === "string" && typeof g.meaning === "string")
        .map((g) => ({ term: g.term, meaning: g.meaning })),
      flags: asStringArray(out.flags)
    };
  }
});
