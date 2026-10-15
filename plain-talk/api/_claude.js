// One call to the Anthropic Messages API, with the key kept on the server.

import { HttpError } from "./_security.js";

// Stop a little before the function limit (maxDuration: 60 in vercel.json) so
// the browser gets a JSON error instead of a platform timeout page.
const UPSTREAM_TIMEOUT_MS = 55000;

export async function callClaude(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "Server is not configured: ANTHROPIC_API_KEY is missing.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let response;
  let data;
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
    if (e && e.name === "AbortError") throw new HttpError(504, "The AI took too long to respond. Please try again.");
    throw new HttpError(502, "Could not reach the AI service. Please try again.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok || (data && data.error)) {
    const detail = data && data.error && data.error.message ? data.error.message : "request failed";
    const status = response.status === 401 || response.status === 429 ? response.status : 502;
    throw new HttpError(status, "Anthropic API error (" + response.status + "): " + detail);
  }

  const block = (data.content || []).find((b) => b.type === "text");
  const text = block ? block.text : "";

  // A reply cut off at max_tokens is never valid JSON, so say so plainly.
  if (data.stop_reason === "max_tokens") {
    console.error("Claude reply hit max_tokens", { model: request.model, max_tokens: request.max_tokens, usage: data.usage });
    throw new HttpError(502, "The AI's answer was cut off. Try a shorter input or a summary.");
  }
  return text;
}

// Parse the model's JSON reply, tolerating code fences and stray sentences
// before or after the JSON.
export function parseModelJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (e2) {
        // fall through
      }
    }
    console.error("Could not parse Claude reply as JSON", { length: text.length });
    throw new HttpError(502, "Unexpected reply from the AI. Please try again.");
  }
}
