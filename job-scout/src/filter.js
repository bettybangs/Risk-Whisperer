// Rule-based first pass: cheap, predictable, and runs on every posting.
// Only postings that pass here are sent to Claude for a closer look.

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

// The highest "N+ years" figure in a posting, or null. Ranges such as
// "3-5 years" count as their lower bound, which is what a hiring manager
// usually means by the minimum.
export function requiredYears(text) {
  let max = null;
  const re = /(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b[^.\n]{0,40}?\bexperience/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n > 0 && n <= 30 && (max === null || n > max)) max = n;
  }
  return max;
}

export function requiresClearance(text) {
  return /\b(active|current|must (?:have|hold|possess)|required?)\b[^.\n]{0,40}\b(secret|top secret|TS\/SCI|clearance)\b/i.test(text)
    || /\b(TS\/SCI|top secret)\b/i.test(text);
}

function ageInDays(postedAt, now) {
  if (!postedAt) return null;
  const t = Date.parse(postedAt);
  return Number.isNaN(t) ? null : (now - t) / 86400000;
}

// Returns { pass, score, reasons, flags } for one posting.
export function evaluate(job, config, now = Date.now()) {
  const { profile, match, sources } = config;
  const title = job.title || "";
  const text = `${title}\n${job.description || ""}`;
  const reasons = [];
  const flags = [];

  const titleHits = anyTerm(match.titleInclude, title);
  if (!titleHits.length) return { pass: false, score: 0, reasons: ["title is not a GRC or IAM role"], flags };

  const excluded = anyTerm(match.titleExclude, title);
  if (excluded.length) return { pass: false, score: 0, reasons: [`title contains "${excluded[0]}"`], flags };

  const age = ageInDays(job.postedAt, now);
  const maxAge = (sources && sources.maxAgeDays) || 3;
  // Company boards list every open role, not just new ones; the seen-list
  // stops repeats, so only drop postings that are clearly stale.
  if (age !== null && age > Math.max(maxAge, 30)) return { pass: false, score: 0, reasons: ["posted more than 30 days ago"], flags };

  if (profile.remoteOnly && !job.remote) return { pass: false, score: 0, reasons: ["not remote"], flags };
  if (!job.remote && (profile.locations || []).length) {
    const places = profile.locations.filter((l) => !/^remote$/i.test(l));
    if (places.length && job.location && !anyTerm(places, job.location).length && !isUnitedStates(job.location, places)) {
      return { pass: false, score: 0, reasons: [`location "${job.location}" is outside your list`], flags };
    }
  }

  const clearance = requiresClearance(text);
  if (clearance && !profile.hasClearance) {
    return { pass: false, score: 0, reasons: ["requires a security clearance"], flags };
  }

  let score = titleHits.length * 2;
  reasons.push(`title: ${titleHits.join(", ")}`);

  const skills = anyTerm(match.skills, text);
  score += skills.length;
  if (skills.length) reasons.push(`skills: ${skills.join(", ")}`);

  const certs = anyTerm(profile.certifications, text);
  score += certs.length;
  if (certs.length) reasons.push(`certs mentioned: ${certs.join(", ")}`);

  const years = requiredYears(text);
  if (years !== null && profile.yearsExperience != null) {
    const gap = years - profile.yearsExperience;
    if (gap > 3) return { pass: false, score: 0, reasons: [`asks for ${years}+ years`], flags };
    if (gap > 0) { score -= gap; flags.push(`asks for ${years}+ years (you have ${profile.yearsExperience})`); }
    else reasons.push(`asks for ${years} years`);
  }

  if (job.remote) { score += 1; reasons.push("remote"); }

  return { pass: score >= (match.minScore ?? 3), score, reasons, flags };
}

// Many boards write "Remote - US", "New York, NY", or "Austin, TX, USA".
// When "United States" is in your list, accept any US-looking location.
const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";
function isUnitedStates(location, places) {
  if (!places.some((p) => /^(united states|usa|us)$/i.test(p))) return false;
  return /\b(united states|USA|U\.S\.|US)\b/.test(location) || new RegExp(`,\\s*(${US_STATES})\\b`).test(location);
}

export function filterJobs(jobs, config, now = Date.now()) {
  const kept = [];
  for (const job of jobs) {
    const result = evaluate(job, config, now);
    if (result.pass) kept.push({ ...job, match: result });
  }
  return kept.sort((a, b) => b.match.score - a.match.score);
}
