// Request protections shared by /api/assess, /api/judge, and /api/plain.
//
// What each protection does and why:
//
// 1. POST only. Every endpoint rejects other methods with 405, so the
//    functions cannot be triggered by a link, an image tag, or a crawler.
//
// 2. Origin allowlist. Browsers always send an Origin header on POST. We
//    accept only the production site (riskwhisperer.vercel.app), this
//    deployment's own preview URLs on *.vercel.app (read from Vercel's
//    VERCEL_URL, VERCEL_BRANCH_URL, and VERCEL_PROJECT_PRODUCTION_URL, so
//    another project's *.vercel.app site is not accepted), and localhost when
//    running in development. This stops other websites from spending our API
//    budget through a visitor's browser. It is not authentication: a script
//    outside a browser can fake the header, so the checks below still apply.
//
// 3. JSON content type. Requiring application/json means a cross-site form
//    post cannot reach the handler, and a cross-site fetch has to pass a CORS
//    preflight, which fails because we send no CORS headers.
//
// 4. Data only, strict fields. The browser sends data, never a prompt or a
//    model name. Unknown fields (for example "system" or "model") are
//    rejected instead of ignored, so it is obvious they have no effect. The
//    server builds every prompt in api/_prompts.js and picks the model and
//    max_tokens itself.
//
// 5. Field validation. framework, env, and family must be one of the allowed
//    values. input is capped at 5,000 characters. controlMappings must be an
//    array of at most 6 objects with exactly {id, name, rationale}. result
//    must have the shape the assessment returns, with size limits on every
//    string and array. Anything else gets a 400 with a clear message.
//
// 6. Prompt-injection screen. The same patterns the browser checks run again
//    here on the user's text, because anyone can call the endpoint without
//    the browser. The browser check stays for instant feedback. The patterns
//    are not run on Plain Talk's `result`: model-written findings routinely
//    use words like "exposed" or "leak". That payload is bounded instead by
//    the shape and size checks, and only goes to a translate-only prompt.
//
// 7. Clear JSON errors and a time limit. Every failure returns
//    { error: { message } }, which the app already displays. The upstream
//    call is aborted before the 60-second function limit so the user
//    sees a message instead of a platform timeout page. Each endpoint makes
//    exactly one model call, so no request chains Haiku and Opus.

import { FRAMEWORKS, ENVS, CONTROL_FAMILIES } from "./_prompts.js";

export const MAX_INPUT_CHARS = 5000;
export const MAX_CONTROL_MAPPINGS = 6;

// Keep in sync with the check in src/App.js.
export const SUSPICIOUS_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /system prompt/i,
  /api.?key/i,
  /reveal|expose|leak|dump/i,
  /jailbreak/i,
  /pretend you are/i,
  /you are now/i,
];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---- Origin allowlist ----

const PRODUCTION_ORIGIN = "https://riskwhisperer.vercel.app";
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

function isDevelopment(env) {
  return env.VERCEL_ENV === "development" || env.NODE_ENV === "development";
}

export function isAllowedOrigin(origin, env = process.env) {
  if (typeof origin !== "string" || origin === "") return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  var ownHosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL];
  for (var i = 0; i < ownHosts.length; i++) {
    var host = ownHosts[i];
    if (host && /\.vercel\.app$/.test(host) && origin === "https://" + host) return true;
  }
  return isDevelopment(env) && LOCALHOST_ORIGIN.test(origin);
}

// ---- Small validation helpers ----

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function checkKeys(obj, allowed, label) {
  var extra = Object.keys(obj).filter(function(k) { return allowed.indexOf(k) === -1; });
  if (extra.length > 0) throw new HttpError(400, "Unexpected field in " + label + ": " + extra.join(", ") + ".");
}

function requireString(value, name, { max, allowEmpty = false }) {
  if (typeof value !== "string") throw new HttpError(400, name + " must be text.");
  if (!allowEmpty && value.trim() === "") throw new HttpError(400, name + " is required.");
  if (value.length > max) throw new HttpError(400, name + " must be " + max.toLocaleString("en-US") + " characters or fewer.");
  return value;
}

function requireOneOf(value, name, allowed) {
  if (typeof value !== "string" || allowed.indexOf(value) === -1) {
    throw new HttpError(400, "Unsupported " + name + ". Pick one from the list.");
  }
  return value;
}

function requireStringArray(value, name, { maxItems, maxChars }) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpError(400, name + " must be a list of at most " + maxItems + " items.");
  }
  value.forEach(function(item) { requireString(item, name + " item", { max: maxChars, allowEmpty: true }); });
  return value;
}

function checkInjection(input) {
  if (SUSPICIOUS_PATTERNS.some(function(p) { return p.test(input); })) {
    throw new HttpError(400, "Input contains unsupported content. Please describe a security control or system configuration.");
  }
}

function requireInput(value) {
  var input = requireString(value, "Input", { max: MAX_INPUT_CHARS });
  checkInjection(input);
  return input;
}

// ---- Per-endpoint validators ----

export function validateAssessBody(body) {
  checkKeys(body, ["framework", "env", "family", "input"], "request");
  return {
    framework: requireOneOf(body.framework, "framework", FRAMEWORKS),
    env: requireOneOf(body.env, "cloud environment", ENVS),
    family: requireOneOf(body.family, "control family", CONTROL_FAMILIES),
    input: requireInput(body.input)
  };
}

export function validateJudgeBody(body) {
  checkKeys(body, ["framework", "input", "controlMappings"], "request");
  var framework = requireOneOf(body.framework, "framework", FRAMEWORKS);
  var input = requireInput(body.input);
  var mappings = body.controlMappings;
  if (!Array.isArray(mappings) || mappings.length > MAX_CONTROL_MAPPINGS) {
    throw new HttpError(400, "controlMappings must be a list of at most " + MAX_CONTROL_MAPPINGS + " items.");
  }
  var controlMappings = mappings.map(function(c) {
    if (!isPlainObject(c)) throw new HttpError(400, "Each control mapping must be an object with id, name, and rationale.");
    checkKeys(c, ["id", "name", "rationale"], "control mapping");
    var id = requireString(c.id, "Control id", { max: 40 });
    // Control ids go into the judge prompt, so no line breaks or control characters.
    if (/[\u0000-\u001f\u007f]/.test(id)) throw new HttpError(400, "Control id contains unsupported characters.");
    return {
      id: id,
      name: requireString(c.name, "Control name", { max: 300, allowEmpty: true }),
      rationale: requireString(c.rationale, "Control rationale", { max: 3000, allowEmpty: true })
    };
  });
  return { framework, input, controlMappings };
}

// The keys an assessment result may carry, in the order the app stores them.
// Unknown keys are dropped rather than rejected, since they come from the
// model's own earlier output, not from the user.
const RESULT_KEYS = ["assessmentQuestions", "evidenceToCollect", "potentialWeaknesses", "controlMappings", "overallRiskScore", "riskJustification", "controlMaturity", "maturityJustification"];
const WEAKNESS_KEYS = ["name", "description", "severity", "recommendation", "id"];
const MAPPING_KEYS = ["id", "name", "rationale", "weakFit", "weakFitUnverified"];
const MAX_RESULT_CHARS = 40000;

function pickKeys(obj, keys) {
  var out = {};
  Object.keys(obj).forEach(function(k) { if (keys.indexOf(k) !== -1) out[k] = obj[k]; });
  return out;
}

function requireObjectArray(value, name, keys, stringKeys) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new HttpError(400, "result." + name + " must be a list of at most 20 items.");
  }
  return value.map(function(item) {
    if (!isPlainObject(item)) throw new HttpError(400, "Each item in result." + name + " must be an object.");
    var clean = pickKeys(item, keys);
    Object.keys(clean).forEach(function(k) {
      var v = clean[k];
      var ok = k === "weakFitUnverified" ? typeof v === "boolean"
        : k === "id" && name === "potentialWeaknesses" ? typeof v === "string" || typeof v === "number"
        : typeof v === "string" && v.length <= 3000;
      if (!ok) throw new HttpError(400, "result." + name + " has an invalid " + k + ".");
    });
    stringKeys.forEach(function(k) {
      if (typeof clean[k] !== "string") throw new HttpError(400, "Each item in result." + name + " needs " + stringKeys.join(", ") + ".");
    });
    return clean;
  });
}

export function validatePlainBody(body) {
  checkKeys(body, ["result"], "request");
  var r = body.result;
  if (!isPlainObject(r)) throw new HttpError(400, "result must be an assessment object.");
  var result = pickKeys(r, RESULT_KEYS);
  var listLimits = { maxItems: 20, maxChars: 3000 };
  requireStringArray(result.assessmentQuestions, "result.assessmentQuestions", listLimits);
  requireStringArray(result.evidenceToCollect, "result.evidenceToCollect", listLimits);
  result.potentialWeaknesses = requireObjectArray(result.potentialWeaknesses, "potentialWeaknesses", WEAKNESS_KEYS, ["name", "description", "severity", "recommendation"]);
  result.controlMappings = requireObjectArray(result.controlMappings, "controlMappings", MAPPING_KEYS, ["id"]);
  var score = result.overallRiskScore;
  if (!(typeof score === "number" && isFinite(score)) && !(typeof score === "string" && /^\s*\d+(\.\d+)?\s*$/.test(score))) {
    throw new HttpError(400, "result.overallRiskScore must be a number.");
  }
  requireString(result.riskJustification, "result.riskJustification", { max: 3000, allowEmpty: true });
  requireString(result.controlMaturity, "result.controlMaturity", { max: 40, allowEmpty: true });
  requireString(result.maturityJustification, "result.maturityJustification", { max: 3000, allowEmpty: true });
  if (JSON.stringify(result).length > MAX_RESULT_CHARS) throw new HttpError(400, "result is too large.");
  return { result };
}

// ---- Handler wrapper ----

function sendError(res, status, message) {
  return res.status(status).json({ error: { message } });
}

// Wraps an endpoint with the protections above. `validate` turns the body
// into clean data (or throws HttpError 400); `run` makes the one model call.
export function createHandler({ validate, run }) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendError(res, 405, "Method not allowed. Use POST.");
    }
    if (!isAllowedOrigin(req.headers.origin)) {
      return sendError(res, 403, "Requests from this origin are not allowed.");
    }
    if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) {
      return sendError(res, 415, "Content-Type must be application/json.");
    }

    try {
      var body;
      try {
        body = req.body;
      } catch (e) {
        // Vercel throws when the body is not valid JSON.
        throw new HttpError(400, "Request body could not be parsed.");
      }
      if (!isPlainObject(body)) throw new HttpError(400, "Request body must be an object.");
      var data = validate(body);
      var payload = await run(data);
      return res.status(200).json(payload);
    } catch (e) {
      if (e instanceof HttpError) return sendError(res, e.status, e.message);
      console.error(e);
      return sendError(res, 500, "Something went wrong on the server. Please try again.");
    }
  };
}
