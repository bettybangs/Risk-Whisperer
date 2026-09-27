import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToText, normalizeGreenhouse, normalizeLever, normalizeAshby, normalizeUsajobs, normalizeRemotive, normalizeAdzuna, buildTasks, fetchAll } from "../src/sources.js";
import { evaluate, filterJobs, requiredYears, requiresClearance, termRegex } from "../src/filter.js";
import { reviewJobs, buildUserMessage } from "../src/claude.js";
import { buildDigest } from "../src/digest.js";

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, "..", "config.json"), "utf8"));
const NOW = Date.parse("2026-09-27T12:00:00Z");

function job(overrides) {
  return { id: "x:1", source: "Test", company: "Acme", title: "GRC Analyst", location: "Remote - US", remote: true,
    url: "https://example.com/1", postedAt: "2026-09-26T00:00:00Z", salary: null,
    description: "Support SOC 2 and ISO 27001 audits, run user access reviews in Okta, maintain POA&M. 2+ years of GRC experience.", ...overrides };
}

test("termRegex matches whole words and treats spaces and hyphens alike", () => {
  assert.ok(termRegex("IAM").test("Senior IAM Engineer"));
  assert.ok(!termRegex("IAM").test("William"));
  assert.ok(!termRegex("VP").test("VPN Administrator"));
  assert.ok(termRegex("third party risk").test("Third-Party Risk Analyst"));
  assert.ok(termRegex("SOC 2").test("SOC 2 Type II"));
  assert.ok(termRegex("POA&M").test("track POA&M items"));
});

test("requiredYears reads the minimum years of experience", () => {
  assert.equal(requiredYears("5+ years of experience in IAM"), 5);
  assert.equal(requiredYears("3-5 years of relevant GRC experience"), 3);
  assert.equal(requiredYears("at least 2 years experience; 7 years' professional experience preferred"), 7);
  assert.equal(requiredYears("founded 12 years ago"), null);
});

test("requiresClearance spots mandatory clearances", () => {
  assert.ok(requiresClearance("Must have an active Secret clearance"));
  assert.ok(requiresClearance("TS/SCI with polygraph"));
  assert.ok(!requiresClearance("Ability to obtain a public trust"));
});

test("evaluate keeps a matching GRC role and explains why", () => {
  const r = evaluate(job(), config, NOW);
  assert.ok(r.pass);
  assert.match(r.reasons.join(" "), /SOC 2/);
});

test("evaluate drops non-GRC titles, excluded titles, clearances, and big experience gaps", () => {
  assert.equal(evaluate(job({ title: "Frontend Engineer" }), config, NOW).pass, false);
  assert.equal(evaluate(job({ title: "Director, GRC" }), config, NOW).pass, false);
  assert.equal(evaluate(job({ title: "Compliance Sales Account Executive" }), config, NOW).pass, false);
  assert.equal(evaluate(job({ title: "Credit Risk Analyst" }), config, NOW).pass, false);
  assert.equal(evaluate(job({ description: "IAM work. Must hold an active Top Secret clearance." }), config, NOW).pass, false);
  assert.equal(evaluate(job({ description: "SOC 2 audits. 10+ years of experience required." }), config, NOW).pass, false);
});

test("evaluate flags a small experience gap instead of dropping the role", () => {
  const r = evaluate(job({ description: "SOC 2, ISO 27001, Okta, access review, POA&M. 5+ years of experience." }), config, NOW);
  assert.ok(r.pass);
  assert.match(r.flags[0], /5\+ years/);
});

test("evaluate respects the location list", () => {
  assert.equal(evaluate(job({ location: "London, UK", remote: false }), config, NOW).pass, false);
  assert.equal(evaluate(job({ location: "Austin, TX", remote: false }), config, NOW).pass, true);
  const remoteOnly = { ...config, profile: { ...config.profile, remoteOnly: true } };
  assert.equal(evaluate(job({ location: "Austin, TX", remote: false }), remoteOnly, NOW).pass, false);
});

test("filterJobs sorts by score", () => {
  const out = filterJobs([
    job({ id: "a", title: "Compliance Analyst", description: "SOC 2." }),
    job({ id: "b", title: "IAM Analyst", description: "Okta, SailPoint, SAML, SCIM, access review, provisioning, least privilege." }),
    job({ id: "c", title: "Software Engineer" })
  ], config, NOW);
  assert.deepEqual(out.map((j) => j.id), ["b", "a"]);
});

test("htmlToText decodes Greenhouse's escaped HTML", () => {
  assert.equal(htmlToText("&lt;p&gt;SOC 2 &amp;amp; ISO&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Okta&lt;/li&gt;&lt;/ul&gt;"), "SOC 2 & ISO\nOkta");
});

test("each source normalizes to the common shape", () => {
  const all = [
    ...normalizeGreenhouse("okta", { jobs: [{ id: 1, title: "IAM Analyst", absolute_url: "https://g/1", location: { name: "Remote, US" }, updated_at: "2026-09-26", content: "&lt;p&gt;Okta&lt;/p&gt;" }] }),
    ...normalizeLever("plaid", [{ id: "2", text: "GRC Analyst", hostedUrl: "https://l/2", categories: { location: "San Francisco" }, workplaceType: "remote", createdAt: 1790000000000, descriptionPlain: "SOC 2", lists: [{ text: "Requirements", content: "<li>3 years</li>" }] }]),
    ...normalizeAshby("vanta", { jobs: [{ id: "3", title: "Compliance Manager", location: "Remote", isRemote: true, jobUrl: "https://a/3", descriptionPlain: "ISO 27001", publishedAt: "2026-09-25" }] }),
    ...normalizeRemotive({ jobs: [{ id: 4, url: "https://r/4", title: "GRC Lead", company_name: "Co", candidate_required_location: "USA", description: "<p>FedRAMP</p>" }] }),
    ...normalizeUsajobs({ SearchResult: { SearchResultItems: [{ MatchedObjectDescriptor: { PositionID: "5", PositionTitle: "IT Specialist (INFOSEC)", PositionURI: "https://u/5", OrganizationName: "DHS", PositionLocationDisplay: "Washington, DC", QualificationSummary: "RMF", PositionRemuneration: [{ MinimumRange: "90000", MaximumRange: "120000", Description: "Per Year" }], UserArea: { Details: { JobSummary: "ISSO", RemoteIndicator: false } } } }] } }),
    ...normalizeAdzuna({ results: [{ id: "6", title: "<strong>IAM</strong> Analyst", company: { display_name: "Bank" }, location: { display_name: "Charlotte, NC" }, redirect_url: "https://z/6", description: "SailPoint", salary_min: 95000, salary_max: 110000 }] })
  ];
  assert.equal(all.length, 6);
  for (const j of all) {
    for (const key of ["id", "source", "company", "title", "url"]) assert.ok(j[key], `${j.source} is missing ${key}`);
    assert.equal(typeof j.remote, "boolean");
    assert.equal(typeof j.description, "string");
  }
  assert.equal(all[1].remote, true);
  assert.match(all[1].description, /3 years/);
  assert.equal(all[4].salary, "$90,000 - $120,000 / year");
  assert.equal(all[5].title, "IAM Analyst");
});

test("buildTasks skips keyed sources without keys and fetchAll reports failures", async () => {
  const tasks = buildTasks({ greenhouse: ["a"], usajobs: ["GRC"], adzuna: ["IAM"] }, {});
  assert.deepEqual(tasks.filter((t) => t.skipped).map((t) => t.name), ["usajobs", "adzuna"]);

  const { jobs, report } = await fetchAll([
    { name: "good", run: async () => [job({ id: "1" }), job({ id: "1" })] },
    { name: "bad", run: async () => { throw new Error("HTTP 404"); } },
    { name: "keyed", skipped: "no key" }
  ]);
  assert.equal(jobs.length, 1, "duplicates are removed");
  assert.deepEqual(report.map((r) => r.status).sort(), ["error", "ok", "skipped"]);
});

test("reviewJobs drops 'no' fits, keeps failed reviews, and sorts by fit score", async () => {
  const replies = { a: { fit: "good", score: 70 }, b: { fit: "no", score: 10 }, c: null, d: { fit: "strong", score: 90 } };
  const fakeClient = { beta: { messages: { create: async (req) => {
    assert.equal(req.fallbacks, "default");
    assert.equal(req.output_config.format.type, "json_schema");
    const id = req.messages[0].content.match(/Title: (\w)/)[1];
    if (!replies[id]) throw new Error("boom");
    return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ...replies[id], meets: [], gaps: [], summary: "ok" }) }] };
  } } } };
  const jobs = ["a", "b", "c", "d", "e"].map((t) => ({ ...job({ id: t, title: t }), match: { score: 5, reasons: [], flags: [] } }));
  const { reviewed, unreviewed } = await reviewJobs(jobs, "résumé", { limit: 4, client: fakeClient, log: () => {} });
  assert.deepEqual(reviewed.map((j) => j.id), ["d", "a", "c"]);
  assert.deepEqual(unreviewed.map((j) => j.id), ["e"]);
});

test("the posting is fenced off from the résumé and truncated", () => {
  const msg = buildUserMessage("RESUME", job({ description: "x".repeat(20000) }));
  assert.match(msg, /^<resume>\nRESUME\n<\/resume>/);
  assert.ok(msg.length < 13000);
});

test("buildDigest groups by fit and lists source problems", () => {
  const md = buildDigest({
    date: "2026-09-27", scanned: 40, aiUsed: true,
    report: [{ name: "greenhouse/okta", status: "ok", detail: "12 postings" }, { name: "lever/nope", status: "error", detail: "HTTP 404" }],
    jobs: [
      { ...job({ id: "1", title: "IAM Analyst [Remote]" }), match: { score: 6, reasons: ["title: IAM"], flags: [] }, review: { fit: "strong", score: 88, meets: ["Okta"], gaps: [], summary: "Close match." } },
      { ...job({ id: "2" }), match: { score: 4, reasons: ["title: GRC"], flags: [] } }
    ]
  });
  assert.match(md, /## 🟢 Strong fit/);
  assert.match(md, /IAM Analyst \\\[Remote\\\]/);
  assert.match(md, /## Not reviewed by AI/);
  assert.match(md, /❌ lever\/nope: HTTP 404/);
  assert.match(buildDigest({ date: "d", jobs: [], report: [], scanned: 0 }), /No new matching roles/);
});
