// Request protections shared by every endpoint.
//
// 1. POST only (405 otherwise).
// 2. Origin allowlist: ALLOWED_ORIGINS (comma-separated), this deployment's
//    own *.vercel.app URLs, and localhost in development. Not authentication:
//    it stops other websites spending your API budget through a visitor's
//    browser, nothing more.
// 3. application/json only, so cross-site form posts cannot reach the handler.
// 4. Data only, strict fields. Unknown fields are rejected, never ignored.
// 5. No keyword screen on the text. This tool's input is technical writing
//    ("exposed", "leak", "key"), so words are not a useful signal. Instead the
//    text is sent inside <document> tags with an instruction to treat it as
//    material to translate, and the output is only displayed, never executed.
// 6. Clear JSON errors and a time limit (see _claude.js).

import { AUDIENCES, LENGTHS, MODES, MAX_INPUT_CHARS } from "./_prompts.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

function isDevelopment(env) {
  return env.VERCEL_ENV === "development" || env.NODE_ENV === "development";
}

export function isAllowedOrigin(origin, env = process.env) {
  if (typeof origin !== "string" || origin === "") return false;
  const extra = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  const ownHosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL];
  for (const host of ownHosts) {
    if (host && /\.vercel\.app$/.test(host) && origin === "https://" + host) return true;
  }
  return isDevelopment(env) && LOCALHOST_ORIGIN.test(origin);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function checkKeys(obj, allowed) {
  const extra = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (extra.length > 0) throw new HttpError(400, "Unexpected field: " + extra.join(", ") + ".");
}

function requireString(value, name, max) {
  if (typeof value !== "string") throw new HttpError(400, name + " must be text.");
  if (value.trim() === "") throw new HttpError(400, name + " is required.");
  if (value.length > max) throw new HttpError(400, name + " must be " + max.toLocaleString("en-US") + " characters or fewer.");
  return value;
}

function requireOneOf(value, name, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new HttpError(400, "Unsupported " + name + ". Pick one from the list.");
  }
  return value;
}

export function validateTranslateBody(body) {
  checkKeys(body, ["text", "audience", "mode", "length"]);
  return {
    text: requireString(body.text, "Text", MAX_INPUT_CHARS),
    audience: requireOneOf(body.audience, "audience", AUDIENCES),
    mode: requireOneOf(body.mode, "mode", MODES),
    length: requireOneOf(body.length, "length", LENGTHS)
  };
}

export function validateVerifyBody(body) {
  checkKeys(body, ["original", "translation"]);
  return {
    original: requireString(body.original, "Original", MAX_INPUT_CHARS),
    translation: requireString(body.translation, "Translation", MAX_INPUT_CHARS * 2)
  };
}

function sendError(res, status, message) {
  return res.status(status).json({ error: { message } });
}

// Wraps an endpoint with the protections above. `validate` turns the body into
// clean data (or throws HttpError 400); `run` makes the model call.
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
      let body;
      try {
        body = req.body;
      } catch (e) {
        throw new HttpError(400, "Request body could not be parsed.");
      }
      if (!isPlainObject(body)) throw new HttpError(400, "Request body must be an object.");
      const data = validate(body);
      const payload = await run(data);
      return res.status(200).json(payload);
    } catch (e) {
      if (e instanceof HttpError) return sendError(res, e.status, e.message);
      console.error(e);
      return sendError(res, 500, "Something went wrong on the server. Please try again.");
    }
  };
}
