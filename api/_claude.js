// One call to the Anthropic Messages API, with the key kept on the server.

import { HttpError } from "./_security.js";

// Stop waiting a little before the function limit (maxDuration: 60 in
// vercel.json) so the browser gets a JSON error instead of a platform
// timeout page. A full Haiku assessment can take longer than 30 seconds.
const UPSTREAM_TIMEOUT_MS = 55000;

export async function callClaude(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "Server is not configured: ANTHROPIC_API_KEY is missing.");
  }

  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, UPSTREAM_TIMEOUT_MS);
  var response;
  var data;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    data = await response.json();
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new HttpError(504, "The AI took too long to respond. Please try again.");
    }
    throw new HttpError(502, "Could not reach the AI service. Please try again.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok || (data && data.error)) {
    // Keep the status code in the message: the app maps 401 and 429 to
    // specific advice.
    var detail = data && data.error && data.error.message ? data.error.message : "request failed";
    var status = response.status === 401 || response.status === 429 ? response.status : 502;
    throw new HttpError(status, "Anthropic API error (" + response.status + "): " + detail);
  }

  var block = (data.content || []).find(function(b) { return b.type === "text"; });
  var text = block ? block.text : "";

  // A reply cut off at max_tokens is never valid JSON, so say so plainly
  // instead of reporting a parse error. Logged for the Vercel function logs.
  if (data.stop_reason === "max_tokens") {
    console.error("Claude reply hit max_tokens", { model: request.model, max_tokens: request.max_tokens, usage: data.usage });
    throw new HttpError(502, "The AI's answer was cut off at the " + request.max_tokens + "-token output limit. Please try again.");
  }
  return text;
}

// Replace every em-dash (U+2014) in a string. The prompts already ask the
// models not to use them; this is the safety net. A dash between words
// becomes ", ". Next to punctuation it is dropped instead, so there is no
// doubled punctuation, and at the start or end of the text it is removed.
export function replaceEmDashes(text) {
  if (text.indexOf("\u2014") === -1) return text;
  var out = text.replace(/\s*\u2014+\s*/g, function(match, offset, str) {
    var before = str.slice(0, offset);
    var after = str.slice(offset + match.length);
    if (before === "" || after === "") return "";
    if (/[,;:.!?]$/.test(before)) return " ";
    if (/[(\[]$/.test(before) || /^[,;:.!?)\]]/.test(after)) return "";
    return ", ";
  });
  return out;
}

// Apply replaceEmDashes to every string in a parsed reply (objects, arrays,
// and nested values). Keys and non-string values are left alone.
export function stripEmDashes(value) {
  if (typeof value === "string") return replaceEmDashes(value);
  if (Array.isArray(value)) return value.map(stripEmDashes);
  if (value !== null && typeof value === "object") {
    var out = {};
    Object.keys(value).forEach(function(k) { out[k] = stripEmDashes(value[k]); });
    return out;
  }
  return value;
}

// Parse the model's JSON reply, tolerating the code fences it sometimes adds
// and any sentence it puts before or after the JSON. Every string in the
// result has its em-dashes replaced before it is returned.
export function parseModelJson(text) {
  return stripEmDashes(parseJsonReply(text));
}

function parseJsonReply(text) {
  var cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fall back to the outermost {...} or [...] in the reply.
    var start = cleaned.search(/[[{]/);
    var end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (e2) {
        // fall through
      }
    }
    console.error("Could not parse Claude reply as JSON", { length: text.length, start: text.slice(0, 300), end: text.slice(-300) });
    throw new HttpError(502, "Unexpected JSON from the AI. Please try again.");
  }
}
