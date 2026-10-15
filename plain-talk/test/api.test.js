import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import translate from "../api/translate.js";
import verify from "../api/verify.js";
import { isAllowedOrigin } from "../api/_security.js";
import { buildTranslateRequest, buildVerifyRequest, INDUSTRIES } from "../api/_prompts.js";
import { readFileSync } from "node:fs";
import { parseModelJson } from "../api/_claude.js";

const ORIGIN = "http://localhost:3000";
process.env.NODE_ENV = "development";
process.env.ANTHROPIC_API_KEY = "test-key";

const GOOD = { text: "The service uses TLS 1.3.", audience: "General public", mode: "tech-to-plain", length: "Full translation", industry: "Security findings" };

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

test("verify never reports faithful when a meaning issue exists", async () => {
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

test("industry is required on translate, optional on verify, and must be a known one", async () => {
  const { industry, ...noIndustry } = GOOD;
  let r = res(); await translate(req(noIndustry), r); assert.equal(r.statusCode, 400);
  r = res(); await translate(req({ ...GOOD, industry: "Pirates" }), r); assert.equal(r.statusCode, 400);
  mockClaude(JSON.stringify({ faithful: true, issues: [] }));
  r = res(); await verify(req({ original: "a", translation: "b" }), r); assert.equal(r.statusCode, 200);
  r = res(); await verify(req({ original: "a", translation: "b", industry: "Pirates" }), r); assert.equal(r.statusCode, 400);
});

test("industry rules reach the translate and verify prompts", () => {
  assert.match(buildTranslateRequest(GOOD).system, /security finding/);
  assert.match(buildTranslateRequest(GOOD).system, /severity or risk rating/);
  assert.doesNotMatch(buildTranslateRequest({ ...GOOD, industry: "General" }).system, /Industry rules/);
  assert.match(buildVerifyRequest({ original: "a", translation: "b", industry: "Legal & contracts" }).system, /obligations and permissions/);
});

test("the industry dropdown in index.html matches the server list", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const block = html.match(/<select id="industry">([\s\S]*?)<\/select>/)[1];
  const options = [...block.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  assert.deepEqual(options, INDUSTRIES);
});

test("verify separates meaning issues from added context", async () => {
  mockClaude(JSON.stringify({ faithful: true, issues: [
    { type: "added", impact: "context", original: "o1", translation: "t1", detail: "d1" },
    { type: "changed", impact: "meaning", original: "o2", translation: "t2", detail: "d2" },
    { type: "added", original: "o3", translation: "t3", detail: "d3" }
  ] }));
  let r = res(); await verify(req({ original: "a", translation: "b" }), r);
  assert.equal(r.body.faithful, false);
  assert.deepEqual(r.body.issues.map((i) => i.impact), ["meaning", "meaning", "context"]);
  // Only context issues: still faithful.
  mockClaude(JSON.stringify({ faithful: true, issues: [{ type: "added", impact: "context", original: "o", translation: "t", detail: "d" }] }));
  r = res(); await verify(req({ original: "a", translation: "b" }), r);
  assert.equal(r.body.faithful, true);
  assert.equal(r.body.issues.length, 1);
});

test("translator prompt forbids narrowing scope and unstated claims", () => {
  const s = buildTranslateRequest(GOOD).system;
  assert.match(s, /never narrow or widen scope/);
  assert.match(s, /newest, latest, or current/);
});
