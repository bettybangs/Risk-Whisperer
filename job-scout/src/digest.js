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
const MAX_LISTED = 60;

const FIT_LABEL = { strong: "🟢 Strong fit", good: "🟡 Good fit", stretch: "🟠 Stretch" };

function escapeMd(s) {
  return String(s || "").replace(/([\\[\]|*_`<>])/g, "\\$1");
}

function jobLine(job) {
  const where = [job.location, job.remote && !/remote/i.test(job.location || "") ? "Remote" : null].filter(Boolean).join(" · ");
  const lines = [`### [${escapeMd(job.title)}](${job.url})`, `**${escapeMd(job.company)}** · ${escapeMd(where || "Location not stated")}${job.salary ? ` · ${escapeMd(job.salary)}` : ""} · _${job.source}_`];
  if (job.review) {
    const r = job.review;
    lines.push(`${FIT_LABEL[r.fit] || r.fit} (${r.score}/100): ${escapeMd(r.summary)}`);
    if (r.meets?.length) lines.push(`- ✅ ${r.meets.map(escapeMd).join("; ")}`);
    if (r.gaps?.length) lines.push(`- ⚠️ ${r.gaps.map(escapeMd).join("; ")}`);
  } else {
    lines.push(`Keyword match score ${job.match.score}: ${escapeMd(job.match.reasons.join(" · "))}`);
  }
  if (job.match.flags.length) lines.push(`- ⚠️ ${escapeMd(job.match.flags.join("; "))}`);
  return lines.join("\n");
}

export function buildDigest({ date, jobs, report, scanned, aiUsed }) {
  const out = [`# GRC / IAM roles for ${date}`, ""];
  if (!jobs.length) {
    out.push("No new matching roles today.");
  } else {
    out.push(`${jobs.length} new role${jobs.length === 1 ? "" : "s"} matched out of ${scanned} postings scanned.${aiUsed ? " Ranked by Claude's fit review." : " Ranked by keyword score."}`, "");
    const listed = jobs.slice(0, MAX_LISTED);
    for (const group of ["strong", "good", "stretch", null]) {
      const items = listed.filter((j) => (j.review?.fit ?? null) === group);
      if (!items.length) continue;
      if (aiUsed) out.push(`## ${group ? FIT_LABEL[group] : "Not reviewed by AI"}`, "");
      for (const job of items) out.push(jobLine(job), "");
    }
    if (jobs.length > listed.length) out.push(`_${jobs.length - listed.length} lower-scoring matches not shown. Raise \`minScore\` in config.json to tighten the list._`, "");
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
