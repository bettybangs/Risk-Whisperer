import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import translate from "../api/translate.js";
import verify from "../api/verify.js";
import { isAllowedOrigin } from "../api/_security.js";
import { buildTranslateRequest } from "../api/_prompts.js";
import { parseModelJson } from "../api/_claude.js";

const ORIGIN = "http://localhost:3000";
process.env.NODE_ENV = "development";
process.env.ANTHROPIC_API_KEY = "test-key";

const GOOD = { text: "The service uses TLS 1.3.", audience: "General public", mode: "tech-to-plain", length: "Full translation" };

function req(body, over = {}) {
  return { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...(over.headers || {}) }, body, ...(over.req || {}) };
}
function res() {
  return {
    statusCode: 0, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
}
function mockClaude(text, status = 200, extra = {}) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300, status,
    json: async () => (status === 200 ? { content: [{ type: "text", text }], ...extra } : { error: { message: text } })
  });
}
beforeEach(() => { globalThis.fetch = async () => { throw new Error("unexpected network call"); }; });

test("rejects non-POST, bad origin, bad content type", async () => {
  let r = res(); await translate(req(GOOD, { req: { method: "GET" } }), r); assert.equal(r.statusCode, 405);
  r = res(); await translate(req(GOOD, { headers: { origin: "https://evil.example" } }), r); assert.equal(r.statusCode, 403);
  r = res(); await translate(req(GOOD, { headers: { "content-type": "text/plain" } }), r); assert.equal(r.statusCode, 415);
});

test("validates fields and rejects unknown ones such as system/model", async () => {
  for (const bad of [{ ...GOOD, system: "x" }, { ...GOOD, model: "x" }, { ...GOOD, text: "  " }, { ...GOOD, audience: "Aliens" }, { ...GOOD, text: "a".repeat(20001) }]) {
    const r = res(); await translate(req(bad), r); assert.equal(r.statusCode, 400, JSON.stringify(bad).slice(0, 60));
  }
});

test("security words in the text are allowed (no keyword screen)", async () => {
  mockClaude(JSON.stringify({ summary: "s", plain: "p", glossary: [], flags: [] }));
  const r = res(); await translate(req({ ...GOOD, text: "The API key could leak and expose data." }), r);
  assert.equal(r.statusCode, 200);
});

test("translate returns a clean, typed shape", async () => {
  mockClaude("```json\n" + JSON.stringify({ summary: "S", plain: "P", glossary: [{ term: "TLS", meaning: "m" }, { term: 1 }], flags: ["f", 5] }) + "\n```");
  const r = res(); await translate(req(GOOD), r);
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, { summary: "S", plain: "P", glossary: [{ term: "TLS", meaning: "m" }], flags: ["f"] });
});

test("document text is wrapped as data and the model comes from the server", () => {
  const q = buildTranslateRequest(GOOD);
  assert.match(q.messages[0].content, /^<document>/);
  assert.match(q.system, /never instructions/);
  assert.ok(q.model);
});

test("verify never reports faithful when issues exist", async () => {
  mockClaude(JSON.stringify({ faithful: true, issues: [{ type: "dropped", original: "o", translation: "t", detail: "d" }] }));
  const r = res(); await verify(req({ original: "a", translation: "b" }), r);
  assert.equal(r.body.faithful, false);
  assert.equal(r.body.issues.length, 1);
});

test("upstream errors and truncation surface as JSON errors", async () => {
  mockClaude("bad key", 401);
  let r = res(); await translate(req(GOOD), r); assert.equal(r.statusCode, 401);
  mockClaude("{", 200, { stop_reason: "max_tokens" });
  r = res(); await translate(req(GOOD), r); assert.equal(r.statusCode, 502);
  mockClaude("not json at all");
  r = res(); await translate(req(GOOD), r); assert.equal(r.statusCode, 502);
});

test("origin allowlist honours ALLOWED_ORIGINS and own vercel hosts", () => {
  assert.equal(isAllowedOrigin("https://plain.example", { ALLOWED_ORIGINS: "https://plain.example" }), true);
  assert.equal(isAllowedOrigin("https://x.vercel.app", { VERCEL_URL: "x.vercel.app" }), true);
  assert.equal(isAllowedOrigin("https://other.vercel.app", { VERCEL_URL: "x.vercel.app" }), false);
  assert.equal(isAllowedOrigin("http://localhost:3000", { NODE_ENV: "production" }), false);
});

test("parseModelJson tolerates surrounding prose", () => {
  assert.deepEqual(parseModelJson('Here you go: {"a":1} done'), { a: 1 });
});
