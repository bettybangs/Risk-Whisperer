// Seen-list and the Markdown digest.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Postings stay on the seen-list this long, so a role that is re-posted
// after two months shows up again.
const FORGET_AFTER_DAYS = 60;

export function loadSeen(path) {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
}

export function saveSeen(path, seen, now = new Date()) {
  const cutoff = now.getTime() - FORGET_AFTER_DAYS * 86400000;
  const kept = Object.fromEntries(Object.entries(seen).filter(([, day]) => Date.parse(day) >= cutoff));
  writeFileSync(path, JSON.stringify(kept, null, 1) + "\n");
}

// GitHub issue bodies are capped at 65,536 characters.
const MAX_LISTED = 80;

const TIER_ORDER = { A: 0, B: 1, C: 2 };
const LOCATION_LABEL = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

function escapeMd(s) {
  return String(s || "").replace(/([\\[\]|*_`<>])/g, "\\$1");
}

// Without a Claude review, the keyword score stands in for fit. It is
// deliberately conservative: a keyword match alone never reaches tier A.
export function fitScore(job) {
  if (job.review) return job.review.score;
  return Math.max(1, Math.min(7, Math.round(2 + job.match.score / 2)));
}

// A: fit 8+, B: 6-7, C: 5 or less. Pay below the floor or a staffing agency
// drops a hit one tier.
export function tier(job) {
  const fit = fitScore(job);
  let t = fit >= 8 ? 0 : fit >= 6 ? 1 : 2;
  if (job.match.tags.includes("below floor") || job.match.flags.includes("staffing agency")) t = Math.min(2, t + 1);
  return "ABC"[t];
}

export function mainGap(job) {
  if (job.review) return job.review.mainGap || "None";
  return job.match.gaps[0] || "Not reviewed";
}

function k(n) {
  return "$" + Math.round(n / 1000) + "K";
}

export function formatPay(pay) {
  if (!pay) return "Not listed";
  const range = pay.min === pay.max ? k(pay.min) : `${k(pay.min)}-${k(pay.max)}`;
  return pay.hourly ? `~${range} (hourly)` : range;
}

function row(job) {
  const label = LOCATION_LABEL[job.match.locType];
  const loc = !job.location ? label
    : new RegExp(`\\b${label}\\b`, "i").test(job.location) ? job.location
    : `${label} · ${job.location}`;
  const notes = [...job.match.tags, ...job.match.flags].join(", ");
  return `| ${job.tier} | ${job.fit}${job.review ? "" : "\\*"} | ${escapeMd(job.company)} | [${escapeMd(job.title)}](${job.url}) | ${escapeMd(loc.slice(0, 60))} | ${formatPay(job.match.pay)} | ${escapeMd(mainGap(job))} | ${escapeMd(notes)} |`;
}

const HEADER = ["| Tier | Fit | Company | Title | Location | Pay | Main gap | Tags |", "|---|---|---|---|---|---|---|---|"];

export function rankJobs(jobs) {
  return jobs
    .map((j) => ({ ...j, fit: fitScore(j), tier: tier(j) }))
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.fit - a.fit || b.match.score - a.match.score);
}

export function buildDigest({ date, jobs, report, scanned, aiUsed }) {
  const out = [`# GRC / IAM roles for ${date}`, ""];
  if (!jobs.length) {
    out.push("No new matching roles today.", "");
  } else {
    const ranked = rankJobs(jobs);
    const listed = ranked.slice(0, MAX_LISTED);
    out.push(`${jobs.length} new role${jobs.length === 1 ? "" : "s"} matched out of ${scanned} postings scanned.`, "");
    const sections = [
      ["primary", "Primary: Remote (US)"],
      ["secondary", "Secondary: Hybrid (US) and on-site internships"]
    ];
    for (const [key, heading] of sections) {
      const items = listed.filter((j) => j.match.section === key);
      out.push(`## ${heading}`, "");
      if (items.length) out.push(...HEADER, ...items.map(row), "");
      else out.push("None today.", "");
    }
    if (ranked.length > listed.length) out.push(`_${ranked.length - listed.length} lower-ranked matches not shown._`, "");
    out.push(aiUsed
      ? "Fit is Claude's 1-10 score against your résumé. \\* marks a keyword estimate (not reviewed)."
      : "\\* Fit is a keyword estimate (no Claude review ran). Add `ANTHROPIC_API_KEY` and `JOB_SCOUT_RESUME` for résumé-based scores.", "");
  }

  const problems = report.filter((r) => r.status !== "ok");
  out.push("<details><summary>Sources</summary>", "");
  for (const r of report) out.push(`- ${r.status === "ok" ? "✅" : r.status === "skipped" ? "⏭️" : "❌"} ${r.name}: ${escapeMd(r.detail)}`);
  out.push("", "</details>");
  if (problems.some((r) => r.status === "error")) {
    out.push("", "_A ❌ source usually means a wrong board slug in `job-scout/config.json`._");
  }
  return out.join("\n") + "\n";
}
