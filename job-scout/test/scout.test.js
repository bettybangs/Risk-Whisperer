import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToText, normalizeGreenhouse, normalizeLever, normalizeAshby, normalizeRemotive, normalizeAdzuna, buildTasks, fetchAll } from "../src/sources.js";
import { evaluate, filterJobs, requiredYears, clearanceRequirement, termRegex, parsePay, isUSLocation, locationType, loadSkipList, parseSkipList, skipStatus, companyMatches, EMPTY_SKIP, certTerms, degreeFields, requiredCerts, platformYears } from "../src/filter.js";
import { reviewJobs, buildUserMessage, emptyStats } from "../src/claude.js";
import { buildDigest, rankJobs, formatPay, selectNew, spendLine, estimateCost } from "../src/digest.js";

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, "..", "config.json"), "utf8"));
const NOW = Date.parse("2026-11-05T12:00:00Z");

function job(overrides) {
  return { id: "x:1", source: "Test", company: "Acme", title: "GRC Analyst", location: "Remote - US", remote: true, workplace: null,
    url: "https://example.com/1", postedAt: "2026-11-04T00:00:00Z", salary: "$90,000 - $115,000",
    description: "Support SOC 2 and ISO 27001 audits, run user access reviews in Okta, maintain the risk register. 2+ years of GRC experience.", ...overrides };
}
const check = (overrides, skip = EMPTY_SKIP) => evaluate(job(overrides), config, skip, NOW);
const why = (overrides) => check(overrides).reasons[0];

// ---- matching helpers ---------------------------------------------------

test("termRegex matches whole words and treats spaces and hyphens alike", () => {
  assert.ok(termRegex("IAM").test("IAM Analyst"));
  assert.ok(!termRegex("IAM").test("William"));
  assert.ok(!termRegex("VP").test("VPN Administrator"));
  assert.ok(termRegex("third party risk").test("Third-Party Risk Analyst"));
});

test("parsePay reads ranges, k-notation, and hourly pay", () => {
  assert.deepEqual(parsePay("The base salary range is $90,000 - $120,000 per year."), { min: 90000, max: 120000, hourly: false });
  assert.deepEqual(parsePay("$90-120K + equity"), { min: 90000, max: 120000, hourly: false });
  assert.deepEqual(parsePay("$40 - $50 per hour"), { min: 83200, max: 104000, hourly: true });
  assert.deepEqual(parsePay("Salary: $95K"), { min: 95000, max: 95000, hourly: false });
  assert.deepEqual(parsePay("NYC: $100K - $130K. Remote: $85K - $110K."), { min: 85000, max: 130000, hourly: false });
  assert.equal(parsePay("We raised $50M - $100M from investors"), null);
  assert.equal(parsePay("Founded in 2015, 400 employees"), null);
  assert.equal(parsePay(""), null);
  assert.equal(parsePay("$70K"), null, "a lone figure in a description needs pay words");
  assert.deepEqual(parsePay("$70K", true), { min: 70000, max: 70000, hourly: false }, "but not in a salary field");
});

test("isUSLocation keeps US and unstated locations, drops non-US ones", () => {
  for (const l of ["Remote - US", "Austin, TX", "Remote", "", "Remote (US or Canada)", "U.S. Remote", "Worldwide"]) assert.ok(isUSLocation(l), l);
  for (const l of ["Remote - Canada", "London, UK", "EMEA", "Remote - Latin America", "Bengaluru, India"]) assert.ok(!isUSLocation(l), l);
});

test("locationType uses the board label, then location, then description", () => {
  assert.equal(locationType({ workplace: "hybrid", location: "Remote" }), "hybrid");
  assert.equal(locationType({ location: "Hybrid - Denver, CO" }), "hybrid");
  assert.equal(locationType({ location: "Remote - US" }), "remote");
  assert.equal(locationType({ location: "Chicago, IL", description: "This role is fully remote." }), "remote");
  assert.equal(locationType({ location: "Chicago, IL", description: "Hybrid: 3 days a week in the office." }), "hybrid");
  assert.equal(locationType({ location: "Chicago, IL", description: "Secure our hybrid cloud environment." }), "unclear");
  assert.equal(locationType({ location: "Chicago, IL", description: "This role is fully on-site in our Chicago office." }), "onsite");
  assert.equal(locationType({ location: "On-site - Chicago, IL" }), "onsite");
});

test("requiredYears ignores preferred qualifications", () => {
  assert.equal(requiredYears("5+ years of experience in IAM."), 5);
  assert.equal(requiredYears("3-5 years of relevant GRC experience."), 3);
  assert.equal(requiredYears("2 years of experience required. 6+ years of experience preferred."), 2);
  assert.equal(requiredYears("Founded 12 years ago."), null);
});

test("clearanceRequirement catches clearances but not 'no clearance required'", () => {
  assert.equal(clearanceRequirement("Must have an active Secret clearance."), "active Secret");
  assert.ok(clearanceRequirement("Position requires a Public Trust."));
  assert.ok(clearanceRequirement("Candidates must pass a background investigation."));
  assert.ok(clearanceRequirement("Requires CJIS certification."));
  assert.equal(clearanceRequirement("No security clearance required."), null);
  assert.equal(clearanceRequirement("Standard background check after offer."), null);
});

test("requiredCerts and platformYears only count hard requirements", () => {
  assert.deepEqual(requiredCerts("CISSP certification is required.", ["CISA", "CISSP"]), ["CISSP"]);
  assert.deepEqual(requiredCerts("CISA or CISSP preferred.", ["CISA", "CISSP"]), []);
  assert.deepEqual(requiredCerts("Must hold a current CMMC CCA credential.", []), ["CMMC CCA"]);
  assert.deepEqual(platformYears("3+ years of hands-on ServiceNow GRC administration.", ["ServiceNow", "Wiz"]), { tool: "ServiceNow", years: 3 });
  assert.equal(platformYears("ServiceNow experience a plus, 3 years preferred.", ["ServiceNow"]), null);
});

// ---- the rules ----------------------------------------------------------

test("a remote US role at or above the floor is Primary with no tags", () => {
  const r = check({});
  assert.ok(r.pass);
  assert.equal(r.section, "primary");
  assert.deepEqual(r.tags, []);
});

test("remote under the floor stays, tagged below floor", () => {
  const r = check({ salary: "$70,000 - $80,000" });
  assert.ok(r.pass);
  assert.deepEqual(r.tags, ["below floor"]);
});

test("missing pay is tagged, not dropped", () => {
  const r = check({ salary: null });
  assert.ok(r.pass);
  assert.deepEqual(r.tags, ["pay not listed"]);
});

test("hybrid US is Secondary only at or above the floor or with no pay", () => {
  const hybrid = { location: "Hybrid - Austin, TX", workplace: "hybrid" };
  assert.equal(check(hybrid).section, "secondary");
  assert.deepEqual(check({ ...hybrid, salary: null }).tags, ["pay not listed"]);
  assert.equal(check({ ...hybrid, salary: "$60,000 - $75,000" }).pass, false);
});

test("fully on-site is out, except internships", () => {
  assert.equal(why({ location: "Austin, TX", workplace: "onsite" }), "fully on-site");
  const intern = check({ title: "GRC Intern", location: "Austin, TX", workplace: "onsite", salary: "$25/hr" });
  assert.ok(intern.pass);
  assert.equal(intern.section, "secondary");
  assert.deepEqual(intern.tags, ["below floor", "on-site internship"]);
});

test("non-US remote roles are out", () => {
  assert.match(why({ location: "Remote - Canada" }), /outside the US/);
});

test("target titles match and off-target titles do not", () => {
  for (const t of ["GRC Analyst", "Cloud GRC Analyst", "Security GRC Specialist", "Security Compliance Analyst", "Risk and Compliance Analyst",
    "IT Auditor", "GRC Engineer I", "Cybersecurity Risk Analyst", "AI Governance Analyst", "IAM Analyst", "Identity and Access Management Analyst"]) {
    assert.ok(check({ title: t }).pass, t);
  }
  for (const t of ["Software Engineer", "GRC Manager", "Director, GRC", "SOC Analyst", "Credit Risk Analyst", "Compliance Sales Executive",
    "Mortgage Compliance Analyst", "AML Compliance Analyst", "Procurement Compliance Analyst", "DLP Analyst", "Medical Coding Compliance Analyst"]) {
    assert.equal(check({ title: t }).pass, false, t);
  }
});

test("SOC 2 in a title is not a SOC role", () => {
  assert.ok(check({ title: "SOC 2 Compliance Analyst" }).pass);
});

test("IAM and GRC engineer roles must be entry level", () => {
  assert.equal(check({ title: "Senior IAM Engineer" }).pass, false);
  assert.equal(check({ title: "IAM Analyst II" }).pass, false);
  assert.equal(check({ title: "GRC Engineer III" }).pass, false);
  assert.ok(check({ title: "Associate IAM Analyst" }).pass);
});

test("hard exclusions", () => {
  const cases = {
    "Must hold an active Secret clearance.": /requires/,
    "Must be able to obtain a Public Trust.": /requires/,
    "Subject to a background investigation.": /requires/,
    "Access to CJIS systems requires CJIS clearance.": /requires/,
    "SOC 2 audits. 5+ years of experience required.": /5\+ years/,
    "SOC 2 work. 3+ years of hands-on ServiceNow GRC administration.": /ServiceNow/,
    "SOC 2 support. Monitor security alerts and perform incident response.": /scope/,
    "Own DLP policies and alerts across the fleet, plus SOC 2.": /scope/,
    "CISSP is required for this position. SOC 2 work.": /CISSP/,
    "QSA status required. PCI work.": /QSA/,
    "Support mortgage loan origination compliance and HMDA reporting, plus fair lending reviews.": /domain/,
    "Test SOX controls and ITGCs for our quarterly SOX cycle.": /SOX-only/,
    "Open to students currently enrolled in a bachelor's program. SOC 2 support.": /students/
  };
  for (const [description, reason] of Object.entries(cases)) {
    const r = check({ description });
    assert.equal(r.pass, false, description);
    assert.match(r.reasons[0], reason, description);
  }
});

test("passing mentions do not trigger exclusions", () => {
  assert.ok(check({ description: "SOC 2 and ISO 27001. Maintain the incident response plan. CISA preferred. Familiar with our AML program." }).pass);
  assert.ok(check({ description: "SOX and SOC 2 control testing across our cloud security program." }).pass);
});

test("flags: staffing agency, Senior with 3 or fewer years, AI governance / automation", () => {
  assert.deepEqual(check({ company: "Robert Half" }).flags, ["staffing agency"]);
  assert.deepEqual(check({ description: "Our client, a SaaS company, needs SOC 2 help." }).flags, ["staffing agency"]);
  const senior = check({ title: "Senior GRC Analyst", description: "SOC 2. 3+ years of GRC experience." });
  assert.ok(senior.pass);
  assert.deepEqual(senior.flags, ["Senior title, asks 3 yrs"]);
  assert.equal(check({ title: "Senior GRC Analyst", description: "SOC 2 audits." }).pass, false, "Senior with no years stated");
  assert.deepEqual(check({ title: "AI Governance Analyst" }).flags, ["AI governance / automation"]);
  assert.deepEqual(check({ title: "GRC Engineer I" }).flags, ["AI governance / automation"]);
});

test("skip list matches names and slugs, not lookalikes", () => {
  const list = parseSkipList({ skip_companies: ["Acme Inc.", "vanta", "Globex"] }, "test");
  const matches = (name) => list.companies.some((t) => companyMatches(name, t));
  assert.ok(matches("Acme"));
  assert.ok(matches("ACME Cloud, Inc."));
  assert.ok(matches("Vanta"));
  assert.ok(!matches("Acmeworks"));
  assert.match(check({ company: "Globex Corporation" }, list).reasons[0], /skip list/);
});

function skipFile(data) {
  const path = join(mkdtempSync(join(tmpdir(), "skip-")), "skip.json");
  writeFileSync(path, JSON.stringify(data));
  return path;
}

test("the JOB_SCOUT_SKIP secret wins over skip.json, which wins over nothing", () => {
  const path = skipFile({ skip_companies: ["FromFile"] });
  const fromSecret = loadSkipList(path, { JOB_SCOUT_SKIP: JSON.stringify({ skip_companies: ["FromSecret"] }) });
  assert.ok(fromSecret.companies.some((t) => companyMatches("FromSecret", t)));
  assert.ok(!fromSecret.companies.some((t) => companyMatches("FromFile", t)));
  const fromFile = loadSkipList(path, { JOB_SCOUT_SKIP: "  " });
  assert.ok(fromFile.companies.some((t) => companyMatches("FromFile", t)));
  assert.deepEqual(loadSkipList(join(tmpdir(), "no-such-skip.json"), {}), EMPTY_SKIP);
});

test("a broken skip list stops the run with a clear message", () => {
  assert.throws(() => loadSkipList(null, { JOB_SCOUT_SKIP: "Acme, Globex" }), /JOB_SCOUT_SKIP secret.*not valid JSON/);
  assert.throws(() => parseSkipList({ skip_postings: [{ company: "Acme", title: "GRC", status: "applied", added: "11/01/2026", expires_days: 30 }] }, "t"), /added/);
  assert.throws(() => parseSkipList({ skip_postings: [{ company: "Acme", title: "GRC", status: "applied", added: "2026-11-01" }] }, "t"), /expires_days/);
  assert.throws(() => parseSkipList({ skip_postings: [{ company: "Acme", title: "GRC", status: "maybe" }] }, "t"), /status/);
  assert.throws(() => parseSkipList({ skip_postings: [{ company: "Acme", status: "ruled_out" }] }, "t"), /title keyword/);
  assert.throws(() => parseSkipList({ tag_companies: "Globex" }, "t"), /tag_companies/);
});

test("skip_postings: applied expires and comes back tagged, ruled_out never expires", () => {
  const list = parseSkipList({ skip_postings: [
    { company: "Acme", title: "GRC Analyst", status: "applied", added: "2026-10-01", expires_days: 30 },
    { company: "Initech", title: "IAM", status: "ruled_out", added: "2020-01-01" }
  ] }, "test");
  const day = (d) => Date.parse(`${d}T12:00:00Z`);
  const acme = { company: "Acme Inc.", title: "Senior GRC Analyst" };

  assert.match(skipStatus(acme, list, day("2026-10-30")).drop, /already applied.*2026-10-31/);
  assert.deepEqual(skipStatus(acme, list, day("2026-10-31")), { tags: ["previously applied"], reappearedOn: "2026-10-31" });
  assert.deepEqual(skipStatus({ company: "Acme", title: "IAM Analyst" }, list, day("2026-10-15")), { tags: [], reappearedOn: null }, "other titles at the company are unaffected");
  assert.match(skipStatus({ company: "Initech", title: "IAM Analyst" }, list, day("2036-01-01")).drop, /ruled out/);

  const r = evaluate(job({ company: "Acme", title: "GRC Analyst" }), config, list, day("2026-11-05"));
  assert.ok(r.pass);
  assert.ok(r.tags.includes("previously applied"));
  assert.equal(r.reappearedOn, "2026-10-31");
});

test("an expired 'applied' posting gets past the seen-list once", () => {
  const back = { id: "a", match: { reappearedOn: "2026-10-31" } };
  const plain = { id: "b", match: { reappearedOn: null } };
  assert.deepEqual(selectNew([back, plain], { a: "2026-10-01", b: "2026-10-01" }).map((j) => j.id), ["a"], "seen before it expired: shown again");
  assert.deepEqual(selectNew([back, plain], { a: "2026-11-05", b: "2026-10-01" }), [], "seen since it came back: not repeated");
  assert.deepEqual(selectNew([back, plain], {}).map((j) => j.id), ["a", "b"]);
});

test("tag_companies keeps the posting and tags it prior history", () => {
  const r = check({ company: "Globex" }, parseSkipList({ tag_companies: ["Globex"] }, "test"));
  assert.ok(r.pass);
  assert.deepEqual(r.tags, ["prior history"]);
});

test("skip.example.json is valid and has one entry of each kind", () => {
  const example = JSON.parse(readFileSync(join(here, "..", "skip.example.json"), "utf8"));
  const list = parseSkipList(example, "skip.example.json");
  assert.equal(list.companies.length + list.postings.length + list.tagCompanies.length, 3);
});

test("filterJobs keeps passing jobs, best score first", () => {
  const out = filterJobs([
    job({ id: "a", title: "Compliance Analyst", description: "SOC 2." }),
    job({ id: "b", title: "IAM Analyst", description: "Okta, SailPoint, SAML, SCIM, access review, provisioning, least privilege." }),
    job({ id: "c", title: "Software Engineer" })
  ], config, EMPTY_SKIP, NOW);
  assert.deepEqual(out.map((j) => j.id), ["b", "a"]);
});

// ---- location unclear ---------------------------------------------------

const unclear = { location: "Chicago, IL", description: "Support SOC 2 and ISO 27001 audits and user access reviews in Okta." };

test("a posting that doesn't say remote, hybrid, or on-site goes to Location unclear", () => {
  const r = check(unclear);
  assert.ok(r.pass);
  assert.equal(r.locType, "unclear");
  assert.equal(r.section, "unclear");
});

test("Location unclear keeps pay tags and is never dropped for pay", () => {
  assert.deepEqual(check({ ...unclear, salary: "$60,000 - $70,000" }).tags, ["below floor"]);
  assert.deepEqual(check({ ...unclear, salary: null }).tags, ["pay not listed"]);
});

test("filterJobs orders Primary, then Secondary, then Location unclear", () => {
  const out = filterJobs([
    job({ id: "u", ...unclear, description: unclear.description + " SailPoint, SAML, SCIM, NIST CSF, risk register, vendor risk." }),
    job({ id: "h", location: "Hybrid - Austin, TX", workplace: "hybrid" }),
    job({ id: "r" })
  ], config, EMPTY_SKIP, NOW);
  assert.deepEqual(out.map((j) => j.id), ["r", "h", "u"], "even when the unclear one scores highest");
});

// ---- certifications and degree -------------------------------------------

test("your certifications and degree raise the score", () => {
  assert.deepEqual(certTerms("CompTIA Security+"), ["CompTIA Security+", "Security+"]);
  assert.deepEqual(certTerms("ITIL v4"), ["ITIL v4", "ITIL"]);
  assert.deepEqual(certTerms("AWS Certified Cloud Practitioner"), ["AWS Certified Cloud Practitioner", "Cloud Practitioner"]);
  assert.deepEqual(degreeFields("B.S. Cybersecurity and Information Assurance"), ["Cybersecurity", "Information Assurance"]);

  const base = check({ description: "SOC 2 audits." });
  const certs = check({ description: "SOC 2 audits. Security+ and ITIL preferred." });
  const degree = check({ description: "SOC 2 audits. Bachelor's degree in Information Assurance or a related field." });
  assert.equal(certs.score, base.score + 4);
  assert.match(certs.reasons.join(" "), /CompTIA Security\+, ITIL v4/);
  assert.equal(degree.score, base.score + 2);
});

// ---- sources ------------------------------------------------------------

test("htmlToText decodes Greenhouse's escaped HTML", () => {
  assert.equal(htmlToText("&lt;p&gt;SOC 2 &amp;amp; ISO&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Okta&lt;/li&gt;&lt;/ul&gt;"), "SOC 2 & ISO\nOkta");
});

test("each source normalizes to the common shape", () => {
  const all = [
    ...normalizeGreenhouse("okta", { jobs: [{ id: 1, title: "IAM Analyst", absolute_url: "https://g/1", location: { name: "Remote, US" }, updated_at: "2026-11-04", content: "&lt;p&gt;Okta&lt;/p&gt;" }] }),
    ...normalizeLever("plaid", [{ id: "2", text: "GRC Analyst", hostedUrl: "https://l/2", categories: { location: "San Francisco" }, workplaceType: "hybrid", createdAt: 1790000000000, descriptionPlain: "SOC 2", lists: [{ text: "Requirements", content: "<li>3 years</li>" }] }]),
    ...normalizeAshby("vanta", { jobs: [{ id: "3", title: "Compliance Analyst", location: "Remote", isRemote: true, workplaceType: "Remote", jobUrl: "https://a/3", descriptionPlain: "ISO 27001", publishedAt: "2026-11-03" }] }),
    ...normalizeRemotive({ jobs: [{ id: 4, url: "https://r/4", title: "GRC Lead", company_name: "Co", candidate_required_location: "USA", description: "<p>FedRAMP</p>" }] }),
    ...normalizeAdzuna({ results: [{ id: "6", title: "<strong>IAM</strong> Analyst", company: { display_name: "Bank" }, location: { display_name: "Charlotte, NC" }, redirect_url: "https://z/6", description: "SailPoint", salary_min: 95000, salary_max: 110000 }] })
  ];
  assert.equal(all.length, 5);
  for (const j of all) {
    for (const key of ["id", "source", "company", "title", "url"]) assert.ok(j[key], `${j.source} is missing ${key}`);
    assert.equal(typeof j.description, "string");
  }
  assert.deepEqual(all.map((j) => j.workplace), [null, "hybrid", "remote", "remote", null]);
  assert.match(all[1].description, /3 years/);
  assert.equal(all[4].title, "IAM Analyst");
  assert.deepEqual(parsePay(all[4].salary), { min: 95000, max: 110000, hourly: false });
});

test("USAJOBS is gone and keyed sources are skipped without keys", async () => {
  const tasks = buildTasks({ greenhouse: ["a"], usajobs: ["GRC"], adzuna: ["IAM"] }, { USAJOBS_API_KEY: "k", USAJOBS_EMAIL: "e" });
  assert.ok(!tasks.some((t) => /usajobs/.test(t.name)));
  assert.deepEqual(tasks.filter((t) => t.skipped).map((t) => t.name), ["adzuna"]);

  const { jobs, report } = await fetchAll([
    { name: "good", run: async () => [job({ id: "1" }), job({ id: "1" })] },
    { name: "bad", run: async () => { throw new Error("HTTP 404"); } },
    { name: "keyed", skipped: "no key" }
  ]);
  assert.equal(jobs.length, 1, "duplicates are removed");
  assert.deepEqual(report.map((r) => r.status).sort(), ["error", "ok", "skipped"]);
});

// ---- review and digest --------------------------------------------------

function matched(overrides, matchOverrides = {}) {
  const j = job(overrides);
  return { ...j, match: { ...evaluate(j, config, EMPTY_SKIP, NOW), ...matchOverrides } };
}

test("reviewJobs drops dealbreakers and keeps failed reviews unreviewed", async () => {
  const replies = { a: { score: 7, dealbreaker: "" }, b: { score: 9, dealbreaker: "Requires 5+ years" }, c: null };
  const fakeClient = { beta: { messages: { create: async (req) => {
    assert.equal(req.fallbacks, "default");
    assert.equal(req.output_config.format.type, "json_schema");
    const id = req.messages[0].content.match(/Title: GRC Analyst (\w)/)[1];
    if (!replies[id]) throw new Error("boom");
    return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ...replies[id], mainGap: "None", meets: [], summary: "ok" }) }] };
  } } } };
  const jobs = ["a", "b", "c", "d"].map((t) => matched({ id: t, title: `GRC Analyst ${t}` }));
  const { reviewed, unreviewed } = await reviewJobs(jobs, "résumé", { limit: 3, client: fakeClient, log: () => {} });
  assert.deepEqual(reviewed.map((j) => j.id).sort(), ["a", "c"]);
  assert.equal(reviewed.find((j) => j.id === "a").review.score, 7);
  assert.equal(reviewed.find((j) => j.id === "c").review, undefined);
  assert.deepEqual(unreviewed.map((j) => j.id), ["d"]);
});

test("the posting is fenced off from the résumé and truncated", () => {
  const msg = buildUserMessage("RESUME", job({ description: "x".repeat(20000) }));
  assert.match(msg, /^<resume>\nRESUME\n<\/resume>/);
  assert.ok(msg.length < 13000);
});

test("tiers come from fit, and below floor or staffing drops one tier", () => {
  const review = (score) => ({ score, mainGap: "None", meets: [], dealbreaker: "", summary: "" });
  const ranked = rankJobs([
    { ...matched({ id: "b" }), review: review(7) },
    { ...matched({ id: "a" }), review: review(9) },
    { ...matched({ id: "floor", salary: "$70K" }), review: review(9) },
    { ...matched({ id: "agency", company: "TEKsystems" }), review: review(6) },
    matched({ id: "kw" })
  ]);
  assert.deepEqual(ranked.map((j) => [j.id, j.tier]), [["a", "A"], ["floor", "B"], ["b", "B"], ["kw", "B"], ["agency", "C"]]);
});

test("formatPay", () => {
  assert.equal(formatPay(null), "Not listed");
  assert.equal(formatPay({ min: 90000, max: 120000, hourly: false }), "$90K-$120K");
  assert.equal(formatPay({ min: 83200, max: 83200, hourly: true }), "~$83K (hourly)");
});

test("buildDigest shows Primary and Secondary tables with every field", () => {
  const md = buildDigest({
    date: "2026-11-05", scanned: 40, aiUsed: true,
    report: [{ name: "greenhouse/okta", status: "ok", detail: "12 postings" }, { name: "lever/nope", status: "error", detail: "HTTP 404" }],
    jobs: [
      { ...matched({ id: "1", title: "IAM Analyst [Remote]", company: "Okta" }), review: { score: 8, mainGap: "No SailPoint", meets: [], dealbreaker: "", summary: "" } },
      matched({ id: "2", title: "GRC Analyst", company: "Hybrid Co", location: "Hybrid - Denver, CO", workplace: "hybrid", salary: null })
    ]
  });
  assert.match(md, /## Primary: Remote \(US\)\n\n\| Tier \| Fit \| Company \| Title \| Location \| Pay \| Main gap \| Tags \|/);
  assert.match(md, /\| A \| 8 \| Okta \| \[IAM Analyst \\\[Remote\\\]\]\(https:\/\/example.com\/1\) \| Remote - US \| \$90K-\$115K \| No SailPoint \|  \|/);
  assert.match(md, /## Secondary: Hybrid \(US\) and on-site internships\n\n\|/);
  assert.match(md, /\| Hybrid Co \| \[GRC Analyst\].*\| Hybrid - Denver, CO \| Not listed \| .* \| pay not listed \|/);
  assert.match(md, /❌ lever\/nope: HTTP 404/);
  assert.match(buildDigest({ date: "d", jobs: [], report: [], scanned: 0 }), /No new matching roles/);
});

test("the digest lists Location unclear as a third section, below Secondary", () => {
  const md = buildDigest({
    date: "2026-11-07", scanned: 10, aiUsed: false, report: [],
    jobs: [
      matched({ id: "u", title: "IT Auditor", company: "Unclear Co", ...unclear }),
      matched({ id: "r", company: "Remote Co" })
    ]
  });
  const primary = md.indexOf("## Primary");
  const secondary = md.indexOf("## Secondary");
  const unclearAt = md.indexOf("## Location unclear (check by hand)");
  assert.ok(primary < secondary && secondary < unclearAt, "section order");
  assert.match(md.slice(secondary, unclearAt), /None today\./);
  assert.match(md.slice(unclearAt), /\| Unclear Co \| \[IT Auditor\]\(https:\/\/example.com\/1\) \| Chicago, IL \| \$90K-\$115K \|/);
});

test("reviewJobs counts postings sent and adds up token usage", async () => {
  let call = 0;
  const fakeClient = { beta: { messages: { create: async () => {
    call++;
    const usage = { input_tokens: 1000, output_tokens: 200 };
    if (call === 2) return { stop_reason: "refusal", content: [], usage };
    const verdict = call === 3 ? "Requires 5+ years" : "";
    return { stop_reason: "end_turn", usage, content: [{ type: "text", text: JSON.stringify({ score: 6, mainGap: "None", meets: [], dealbreaker: verdict, summary: "" }) }] };
  } } } };
  const jobs = ["a", "b", "c", "d"].map((t) => matched({ id: t }));
  const { stats } = await reviewJobs(jobs, "résumé", { limit: 3, client: fakeClient, log: () => {} });
  assert.deepEqual(stats, { sent: 3, failed: 1, ruledOut: 1, inputTokens: 3000, outputTokens: 600, cacheReadTokens: 0, cacheWriteTokens: 0 });
});

test("every digest ends with the review count and token usage", () => {
  const stats = { ...emptyStats(), sent: 12, ruledOut: 2, inputTokens: 48000, outputTokens: 9600 };
  assert.equal(estimateCost(stats), 0.48);
  const ran = buildDigest({ date: "d", jobs: [], report: [], scanned: 0, review: { stats } });
  assert.match(ran, /---\n\n\*\*Claude review:\*\* 12 postings sent, 2 ruled out\. Tokens: 48,000 input, 9,600 output\. Estimated cost \$0\.48 at Claude Opus 5 list prices\.\n$/);
  assert.match(spendLine({ reason: "ANTHROPIC_API_KEY not set" }), /not run \(ANTHROPIC_API_KEY not set\)\. 0 tokens used\./);
  assert.match(buildDigest({ date: "d", jobs: [], report: [], scanned: 0 }), /Claude review:\*\* not run/);
});
