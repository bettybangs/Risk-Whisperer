// Rule-based pass: cheap, predictable, and runs on every posting. It applies
// the hard rules (location, pay floor, exclusions), sorts each keeper into the
// Primary (remote US) or Secondary (hybrid US, on-site internship) section,
// and tags anything worth a second look. Only keepers are sent to Claude.

import { readFileSync, existsSync } from "node:fs";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word, case-insensitive match that also works for terms such as
// "SOC 2" or "POA&M". Spaces and hyphens are interchangeable, so
// "third party risk" also matches "third-party risk".
export function termRegex(term) {
  const body = escapeRegex(term.trim()).replace(/(\\-|\s)+/g, "[\\s-]+");
  return new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, "i");
}

function anyTerm(terms, text) {
  return (terms || []).filter((t) => termRegex(t).test(text));
}

function sentences(text) {
  return text.split(/(?<=[.!?;])\s+|\n+/).filter(Boolean);
}

const OPTIONAL = /\b(preferred|nice to have|a plus|bonus|ideally|desired|desirable)\b/i;
const YEARS = /(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b/i;

// ---- Pay ----------------------------------------------------------------

const HOURS_PER_YEAR = 2080;
const MONEY = String.raw`\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kK])?`;
const RANGE_RE = new RegExp(`${MONEY}\\s*(?:-|–|—|to)\\s*(?:\\$\\s?)?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*([kK])?`, "g");
const SINGLE_RE = new RegExp(MONEY, "g");
const PAY_WORDS = /\b(salary|pay|compensation|base|range|starting|wage|rate|OTE|USD)\b/i;

function toNumber(digits, k) {
  return parseFloat(digits.replace(/,/g, "")) * (k ? 1000 : 1);
}

// Turn one amount into annual dollars, or null if it isn't pay (funding
// rounds, stipends, "$5M ARR"). `after` is the text right after the amount.
function annualize(value, after) {
  if (/^\s*(m\b|mm\b|million|b\b|billion)/i.test(after)) return null;
  const hourly = /^[^.\n]{0,20}?(\/\s*h(ou)?r|per hour|an hour|hourly|\/hr)/i.test(after);
  if (hourly || (value >= 15 && value <= 250)) return { annual: Math.round(value * HOURS_PER_YEAR), hourly: true };
  if (value >= 20000 && value <= 1000000) return { annual: Math.round(value), hourly: false };
  return null;
}

// The listed pay as { min, max, hourly } in annual dollars, or null when the
// posting gives none. When a posting lists several ranges (for example one
// per city), the result spans all of them. `payField` marks text from a
// board's own salary field, where a lone figure is always pay.
export function parsePay(text, payField = false) {
  if (!text) return null;
  let min = Infinity, max = -Infinity, hourly = false, found = false;
  const consumed = [];

  for (const m of text.matchAll(RANGE_RE)) {
    const kHigh = Boolean(m[4]);
    let lowValue = toNumber(m[1], m[2]);
    const highValue = toNumber(m[3], m[4]);
    if (!m[2] && kHigh && lowValue < 1000) lowValue *= 1000; // "$90-120K"
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
    const low = annualize(lowValue, after);
    const high = annualize(highValue, after);
    if (!low || !high || low.hourly !== high.hourly || high.annual < low.annual) continue;
    min = Math.min(min, low.annual); max = Math.max(max, high.annual);
    hourly = hourly || low.hourly; found = true;
    consumed.push([m.index, m.index + m[0].length]);
  }
  if (found) return { min, max, hourly };

  // A lone figure counts only when the words around it say it is pay.
  for (const m of text.matchAll(SINGLE_RE)) {
    if (consumed.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
    if (!payField && !PAY_WORDS.test(before) && !/^[^.\n]{0,20}?(\/\s*h(ou)?r|per (hour|year)|an hour|hourly|annually|\/yr|a year)/i.test(after)) continue;
    const pay = annualize(toNumber(m[1], m[2]), after);
    if (pay) return { min: pay.annual, max: pay.annual, hourly: pay.hourly };
  }
  return null;
}

// ---- Location -----------------------------------------------------------

const NON_US = /\b(canada|toronto|vancouver|montreal|ottawa|united kingdom|uk|london|england|scotland|ireland|dublin|europe|european|emea|apac|asia|india|bangalore|bengaluru|hyderabad|pune|germany|berlin|munich|france|paris|spain|madrid|barcelona|netherlands|amsterdam|poland|warsaw|portugal|lisbon|israel|tel aviv|brazil|mexico|latam|latin america|australia|sydney|melbourne|singapore|japan|tokyo|philippines|manila|south africa|romania|ukraine|argentina|colombia|costa rica|new zealand|switzerland|zurich|sweden|stockholm|denmark|norway|finland|italy|belgium|austria|czech|prague|hungary|greece|turkey|uae|dubai|korea|seoul|china|hong kong|taiwan|vietnam|malaysia|indonesia|pakistan|egypt|nigeria|kenya)\b/i;
const US_STATE_NAMES = "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming";
const US = new RegExp(`\\b(united states|usa|us|america|americas|north america|worldwide|anywhere|global|${US_STATE_NAMES})\\b|\\bU\\.S\\.`, "i");

// True unless the location names only places outside the US. "Remote - US
// or Canada" counts as US. A blank location, a bare "Remote", or a city with
// a state code counts as US: the boards searched are mostly US companies,
// and a wrong guess only costs one extra line in the digest.
export function isUSLocation(location) {
  const loc = String(location || "");
  if (US.test(loc.replace(/\b(latin|south|central) america\b/gi, ""))) return true;
  return !NON_US.test(loc);
}

const REMOTE_PHRASE = /\b(fully remote|100% remote|remote[- ]first|remote (position|role|opportunity|job)|work (remotely|from home|from anywhere)|(this|the) (role|position|job) is (fully )?remote|remote within the (US|United States)|remote in the (US|United States))\b/i;
const HYBRID_PHRASE = /\bhybrid\b(?![\s-]+(cloud|environment|infrastructure|IT\b|it\b|identity|deployment|architecture|workforce model))|\b\d\s*(days?|x)\s*(a|per)\s*week\s*(in|at|from)\s*(the|our)?\s*office\b|\bin[- ]office\s+\d\s*days?\b/i;

const ONSITE_WHERE = /\b(on[- ]?site|in[- ]office|in[- ]person)\b/i;
const ONSITE_PHRASE = /\b((this|the) (role|position|job) is (fully |100% )?(on[- ]?site|in[- ]office|in[- ]person)|fully on[- ]?site|100% on[- ]?site|on[- ]?site (position|role|only)|(5|five) days (a|per) week (in|at) (the |our )?office|in[- ]office (5|five) days|must (be able to )?work on[- ]?site|required to work (on[- ]?site|in[- ]office|in the office))\b/i;

// "remote", "hybrid", "onsite", or "unclear". The board's own label wins,
// then the location text, then the description. A posting that never says
// which it is comes back "unclear" and is listed for a manual check.
export function locationType(job) {
  if (job.workplace) return job.workplace;
  const where = `${job.location || ""} ${job.title || ""}`;
  if (/\bhybrid\b/i.test(where)) return "hybrid";
  if (/\bremote\b/i.test(where)) return "remote";
  if (ONSITE_WHERE.test(where)) return "onsite";
  const text = job.description || "";
  if (REMOTE_PHRASE.test(text)) return "remote";
  if (HYBRID_PHRASE.test(text)) return "hybrid";
  if (ONSITE_PHRASE.test(text)) return "onsite";
  return "unclear";
}

export function isInternship(title) {
  return /\b(intern|internship|co-op)\b/i.test(title || "");
}

// ---- Requirements -------------------------------------------------------

// The most years a posting requires, ignoring preferred qualifications.
// Ranges such as "3-5 years" count as their lower bound.
export function requiredYears(text) {
  let max = null;
  for (const s of sentences(text)) {
    if (OPTIONAL.test(s)) continue;
    for (const m of s.matchAll(new RegExp(YEARS.source + String.raw`[^.\n]{0,40}?\bexperience`, "gi"))) {
      const n = Number(m[1]);
      if (n > 0 && n <= 30 && (max === null || n > max)) max = n;
    }
  }
  return max;
}

// Years asked for on a named platform ("3+ years of hands-on ServiceNow").
export function platformYears(text, tools) {
  let worst = null;
  for (const s of sentences(text)) {
    if (OPTIONAL.test(s)) continue;
    const tool = anyTerm(tools, s)[0];
    const m = tool && s.match(YEARS);
    if (m && (worst === null || Number(m[1]) > worst.years)) worst = { tool, years: Number(m[1]) };
  }
  return worst;
}

const CLEARANCE = /\b(security clearance|secret clearance|top secret|TS\/SCI|(active|current|obtain|maintain|hold|eligible for|eligibility for)( a| an)? (secret|clearance)|clearance (is )?required|public trust|background investigation|CJIS)\b/gi;

// The first clearance-type requirement, skipping "no clearance required".
export function clearanceRequirement(text) {
  for (const m of text.matchAll(CLEARANCE)) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 25);
    if (/\b(no|not|without|non)\b[^.\n]*$/i.test(before) || /^\s*(is )?not (required|needed)/i.test(after)) continue;
    return m[0];
  }
  return null;
}

const STUDENT_ONLY = /\b(currently enrolled|current(ly)? (a )?(student|undergraduate|graduate student)|must be (a )?(current )?student|enrolled in an? (accredited )?(bachelor|master|degree|university|college)|returning to (school|university|college)|rising (junior|senior)|pursuing an? (bachelor|master|undergraduate|graduate)('s)? degree|expected graduation)\b/i;

// SOC, DLP, and incident-response duties. Mentions of an incident response
// *plan* or *policy* are normal GRC work and do not count.
const OPS_SCOPE = /\b(SOC analyst|security operations cent(er|re)|alert triage|triage (security )?alerts|monitor (security )?alerts|SIEM monitoring|threat hunting|on-call rotation|incident handling|perform incident response|lead incident response|respond to (security )?incidents|DLP (administration|tooling|tools?|policies|alerts|engineering)|data loss prevention (administration|tooling|tools?|policies|alerts|engineering)|24x7|24\/7 monitoring)\b/i;
const SOC_TITLE = /\bSOC\b(?![\s-]*(1|2|3|I{1,3})\b|\s*type)/i;

const REQUIRED = /\b(required|requires|must (have|hold|possess|be)|mandatory)\b/i;
const NOT_REALLY_REQUIRED = /\b(preferred|nice to have|a plus|bonus|desired|or equivalent|or similar|or working toward|within \d+|ability to obtain|willingness to obtain)\b/i;

// Certifications the posting truly requires (not "preferred").
export function requiredCerts(text, certs) {
  const out = new Set();
  for (const s of sentences(text)) {
    if (!REQUIRED.test(s) || NOT_REALLY_REQUIRED.test(s)) continue;
    for (const c of anyTerm(certs, s)) out.add(c);
  }
  if (/\b(certified CMMC assessor)\b/i.test(text) || /\bCMMC\b[^.\n]{0,40}\bCCA\b|\bCCA\b[^.\n]{0,40}\bCMMC\b/.test(text)) out.add("CMMC CCA");
  return [...out];
}

// Healthcare coding or billing, mortgage or banking regulatory, procurement.
const DOMAIN = /\b(medical coding|medical billing|revenue cycle|ICD-10|CPT coding|mortgage|loan origination|BSA|AML|anti-money laundering|KYC|fair lending|HMDA|UDAAP|consumer compliance|banking regulations?|procurement)\b/gi;
const SECURITY_FRAMEWORKS = /\b(SOC ?2|ISO 27001|ISO 42001|NIST|PCI|HIPAA Security|FedRAMP|HITRUST|GDPR|CIS Controls|CMMC|cloud security|information security|cybersecurity)\b/gi;

function count(re, text) {
  return (text.match(re) || []).length;
}

const STAFFING_AGENCIES = ["Robert Half", "Protiviti Talent", "TEKsystems", "Insight Global", "Randstad", "Kforce", "Apex Systems", "Akkodis", "Modis",
  "Motion Recruitment", "Jobot", "CyberCoders", "Experis", "ManpowerGroup", "Manpower", "Adecco", "Kelly Services", "Aerotek", "Collabera", "Hays",
  "Beacon Hill", "Judge Group", "Mondo", "Signature Consultants", "Russell Tobin", "Vaco", "Addison Group", "Software Guidance & Assistance", "Ascendion",
  "Diverse Lynx", "Infojini", "Mindlance", "Pyramid Consulting", "Yoh", "Hirequest", "LanceSoft", "Talent Groups", "Dexian", "Sigma Staffing", "Staffing"];
const STAFFING_PHRASE = /\b(our client|on behalf of (a|our) client|W2 contract|C2C|corp[- ]to[- ]corp)\b/i;

// ---- Skip list ----------------------------------------------------------

function companyTokens(name) {
  return String(name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|plc|gmbh|technologies|technology|labs|hq)\b/g, " ")
    .trim().split(/\s+/).filter(Boolean);
}

// "Acme" matches "Acme Inc." and "Acme Cloud", but not "Acmeworks".
export function companyMatches(company, tokens) {
  const have = companyTokens(company);
  return tokens.every((t, i) => have[i] === t) || have.join("") === tokens.join("");
}

export const EMPTY_SKIP = { companies: [], postings: [], tagCompanies: [] };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Check a skip list and turn it into what evaluate() needs. A mistake
// stops the run with a message naming the entry, so a typo can't quietly
// let an already-handled posting back in.
//
//   skip_companies  ["Acme"]                         always dropped
//   skip_postings   [{ company, title, status, added, expires_days }]
//                   status "ruled_out" never expires; "applied" is dropped
//                   until expires_days after added, then shown again
//                   tagged "previously applied"
//   tag_companies   ["Globex"]                       kept, tagged "prior history"
export function parseSkipList(data, source) {
  const fail = (msg) => { throw new Error(`Skip list (${source}): ${msg}`); };
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("must be a JSON object");
  const names = (key) => {
    const list = data[key] ?? [];
    if (!Array.isArray(list) || list.some((n) => typeof n !== "string" || !companyTokens(n).length)) fail(`${key} must be a list of company names`);
    return list.map(companyTokens);
  };
  if (!Array.isArray(data.skip_postings ?? [])) fail("skip_postings must be a list");
  const postings = (data.skip_postings ?? []).map((p, i) => {
    const where = `skip_postings[${i}]`;
    if (!p || typeof p !== "object") fail(`${where} must be an object`);
    if (typeof p.company !== "string" || !companyTokens(p.company).length) fail(`${where} needs a company`);
    if (typeof p.title !== "string" || !p.title.trim()) fail(`${where} needs a title keyword`);
    if (p.status !== "ruled_out" && p.status !== "applied") fail(`${where} status must be "ruled_out" or "applied"`);
    const entry = { company: companyTokens(p.company), title: termRegex(p.title), status: p.status, label: `${p.company} / ${p.title}` };
    if (p.status === "applied") {
      if (typeof p.added !== "string" || !DATE.test(p.added) || Number.isNaN(Date.parse(p.added))) fail(`${where} needs "added" as YYYY-MM-DD`);
      if (!Number.isInteger(p.expires_days) || p.expires_days < 1) fail(`${where} needs "expires_days" as a whole number of days`);
      entry.expires = new Date(Date.parse(p.added) + p.expires_days * 86400000).toISOString().slice(0, 10);
    }
    return entry;
  });
  return { companies: names("skip_companies"), postings, tagCompanies: names("tag_companies") };
}

// The JOB_SCOUT_SKIP secret when it is set, otherwise skip.json, otherwise
// an empty list. The secret holds the same JSON as skip.json.
export function loadSkipList(path, env = process.env) {
  if (env.JOB_SCOUT_SKIP && env.JOB_SCOUT_SKIP.trim()) {
    let data;
    try { data = JSON.parse(env.JOB_SCOUT_SKIP); } catch { throw new Error("Skip list (JOB_SCOUT_SKIP secret): not valid JSON"); }
    return parseSkipList(data, "JOB_SCOUT_SKIP secret");
  }
  if (path && existsSync(path)) {
    let data;
    try { data = JSON.parse(readFileSync(path, "utf8")); } catch (e) { throw new Error(`Skip list (skip.json): not valid JSON (${e.message})`); }
    return parseSkipList(data, "skip.json");
  }
  return EMPTY_SKIP;
}

// What the skip list says about one posting: { drop } with a reason, or
// { tags, reappearedOn } to keep it. `reappearedOn` is the date an
// "applied" entry expired, so the seen-list can let it through once.
export function skipStatus(job, skip, now = Date.now()) {
  if (skip.companies.some((t) => companyMatches(job.company, t))) return { drop: "company is on your skip list" };
  const tags = [];
  let reappearedOn = null;
  const today = new Date(now).toISOString().slice(0, 10);
  for (const p of skip.postings) {
    if (!companyMatches(job.company, p.company) || !p.title.test(job.title || "")) continue;
    if (p.status === "ruled_out") return { drop: `ruled out (${p.label})` };
    if (today < p.expires) return { drop: `already applied (${p.label}), back on ${p.expires}` };
    if (!tags.includes("previously applied")) tags.push("previously applied");
    if (!reappearedOn || p.expires > reappearedOn) reappearedOn = p.expires;
  }
  if (skip.tagCompanies.some((t) => companyMatches(job.company, t))) tags.push("prior history");
  return { tags, reappearedOn };
}

// Search terms for a certification: the full name plus the short form most
// postings use ("CompTIA Security+" → "Security+", "ITIL v4" → "ITIL").
export function certTerms(cert) {
  const short = cert.replace(/^(CompTIA|LPI|AWS Certified)\s+/i, "").replace(/\s+v?\d+$/i, "").trim();
  return short && short !== cert ? [cert, short] : [cert];
}

// Fields of study from a degree name: "B.S. Cybersecurity and Information
// Assurance" → ["Cybersecurity", "Information Assurance"].
export function degreeFields(degree) {
  return String(degree || "")
    .replace(/^(B\.?S\.?|B\.?A\.?|Bachelor(?:'s)?(?: of (?:Science|Arts))?)\s+(in\s+)?/i, "")
    .split(/\s+and\s+|,\s*/).map((f) => f.trim()).filter(Boolean);
}

// True when a sentence asks for a degree in one of your fields.
export function mentionsDegree(text, fields) {
  if (!fields.length) return false;
  return sentences(text).some((s) => /\b(bachelor'?s?|B\.S\.|BS|degree)\b/i.test(s) && anyTerm(fields, s).length);
}

// ---- Evaluation ---------------------------------------------------------

function ageInDays(postedAt, now) {
  if (!postedAt) return null;
  const t = Date.parse(postedAt);
  return Number.isNaN(t) ? null : (now - t) / 86400000;
}

function out(reason) {
  return { pass: false, reasons: [reason], score: 0, tags: [], flags: [], gaps: [] };
}

// Returns { pass, section, locType, pay, score, reasons, tags, flags, gaps,
// reappearedOn } for one posting. `tags` are facts shown on every hit (pay not listed,
// below floor); `flags` are reasons to look twice; `gaps` feed "main gap".
export function evaluate(job, config, skip = EMPTY_SKIP, now = Date.now()) {
  const { profile, match } = config;
  const title = job.title || "";
  const description = job.description || "";
  const text = `${title}\n${description}`;
  const floor = profile.payFloor || 0;

  const skipped = skipStatus(job, skip, now);
  if (skipped.drop) return out(skipped.drop);

  const titleHits = anyTerm(match.titleInclude, title);
  if (!titleHits.length) return out("title is not a target GRC or IAM role");
  const excluded = anyTerm(match.titleExclude, title);
  if (excluded.length) return out(`title contains "${excluded[0]}"`);
  if (SOC_TITLE.test(title)) return out("SOC role");

  const senior = /\b(senior|sr)\b/i.test(title);
  const entry = match.entryLevelOnly || {};
  if (anyTerm(entry.terms, title).length && anyTerm(entry.seniorMarkers, title).length) {
    return out("IAM and GRC engineer roles must be entry level");
  }

  const age = ageInDays(job.postedAt, now);
  // Company boards list every open role, not just new ones; the seen-list
  // stops repeats, so only drop postings that are clearly stale.
  if (age !== null && age > 30) return out("posted more than 30 days ago");

  // Location: remote US first, hybrid US second, on-site only for
  // internships. Postings that don't say are kept for a manual check.
  const intern = isInternship(title);
  if (!isUSLocation(job.location)) return out(`location "${job.location}" is outside the US`);
  const locType = locationType(job);
  if (locType === "onsite" && !intern) return out("fully on-site");

  // Hard exclusions.
  const clearance = clearanceRequirement(text);
  if (clearance) return out(`requires ${clearance}`);
  if (STUDENT_ONLY.test(text)) return out("current students only");
  const ops = description.match(OPS_SCOPE);
  if (ops) return out(`SOC / DLP / incident-response scope ("${ops[0]}")`);
  const certs = requiredCerts(text, ["CISA", "CISSP", "QSA"]);
  if (certs.length) return out(`requires ${certs.join(", ")}`);
  // A passing mention is fine; a posting mostly about one of these is not.
  const domainHits = count(DOMAIN, description);
  if (domainHits >= 2 && domainHits > count(SECURITY_FRAMEWORKS, text)) return out(`out-of-scope domain (${description.match(DOMAIN)[0]})`);
  if (/\b(SOX|Sarbanes[- ]Oxley)\b/i.test(text) && !count(SECURITY_FRAMEWORKS, text)) return out("SOX-only");

  const years = requiredYears(text);
  if (years !== null && years > (match.maxYearsRequired ?? 4)) return out(`asks for ${years}+ years`);
  const platform = platformYears(description, match.platformTools);
  if (platform && platform.years > (match.maxPlatformYears ?? 2)) return out(`asks for ${platform.years}+ years of ${platform.tool}`);

  const tags = [...skipped.tags];
  const flags = [];
  const gaps = [];
  if (years !== null && years >= 3) gaps.push(`asks for ${years}+ years`);

  if (senior) {
    if (years === null || years > 3) return out("Senior title without 3 or fewer years stated");
    flags.push(`Senior title, asks ${years} yrs`);
    gaps.push("Senior title");
  }

  // Pay. Remote (and location unclear) under the floor stays, tagged; hybrid
  // under the floor goes, except internships. Postings without pay stay, tagged.
  const pay = parsePay(job.salary, true) || parsePay(description);
  if (!pay) tags.push("pay not listed");
  else if (pay.max < floor) {
    if (locType === "hybrid" && !intern) return out(`hybrid with pay under $${Math.round(floor / 1000)}K`);
    tags.push("below floor");
  }

  if (STAFFING_PHRASE.test(description) || anyTerm(STAFFING_AGENCIES, job.company || "").length) flags.push("staffing agency");
  if (/\b(AI|artificial intelligence|machine learning|automation|GRC engineer(ing)?)\b/i.test(title)
    || /\b(AI governance|compliance automation|policy as code|GRC engineering)\b/i.test(description)) {
    flags.push("AI governance / automation");
  }
  if (intern && locType === "onsite") tags.push("on-site internship");

  let score = titleHits.length * 2;
  const reasons = [`title: ${titleHits.join(", ")}`];
  const skills = anyTerm(match.skills, text);
  score += skills.length;
  if (skills.length) reasons.push(`skills: ${skills.join(", ")}`);
  // Your own certifications and degree count double.
  const held = (profile.certifications || []).filter((c) => anyTerm(certTerms(c), text).length);
  score += held.length * 2;
  if (held.length) reasons.push(`your certs mentioned: ${held.join(", ")}`);
  if (mentionsDegree(text, degreeFields(profile.degree))) { score += 2; reasons.push("asks for your degree field"); }
  if (locType === "remote") score += 1;

  const section = SECTION[locType];
  return { pass: score >= (match.minScore ?? 3), section, locType, pay, score, reasons, tags, flags, gaps, reappearedOn: skipped.reappearedOn };
}

const SECTION = { remote: "primary", hybrid: "secondary", onsite: "secondary", unclear: "unclear" };
export const SECTION_ORDER = { primary: 0, secondary: 1, unclear: 2 };

// Keepers in section order, best score first within each section, so the
// Claude review budget goes to remote roles before the rest.
export function filterJobs(jobs, config, skip = EMPTY_SKIP, now = Date.now()) {
  const kept = [];
  for (const job of jobs) {
    const result = evaluate(job, config, skip, now);
    if (result.pass) kept.push({ ...job, match: result });
  }
  return kept.sort((a, b) => SECTION_ORDER[a.match.section] - SECTION_ORDER[b.match.section] || b.match.score - a.match.score);
}
