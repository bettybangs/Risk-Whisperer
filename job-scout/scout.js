#!/usr/bin/env node
// Daily GRC / IAM job search.
//
//   node scout.js             search, write out/digest-<date>.md, update seen.json
//   node scout.js --all       ignore the seen-list (show everything that matches)
//   node scout.js --no-ai     skip the Claude fit review
//
// Environment:
//   ANTHROPIC_API_KEY                   enables the Claude fit review
//   JOB_SCOUT_RESUME                    résumé text (else profile.resumeFile is read)
//   USAJOBS_API_KEY, USAJOBS_EMAIL      enables federal jobs
//   ADZUNA_APP_ID, ADZUNA_APP_KEY       enables the Adzuna aggregator

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTasks, fetchAll } from "./src/sources.js";
import { filterJobs } from "./src/filter.js";
import { reviewJobs } from "./src/claude.js";
import { loadSeen, saveSeen, buildDigest } from "./src/digest.js";

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const log = (...m) => console.error(...m);

const config = JSON.parse(readFileSync(join(here, "config.json"), "utf8"));
const seenPath = join(here, "seen.json");
const now = new Date();
const date = now.toISOString().slice(0, 10);

function loadResume() {
  if (process.env.JOB_SCOUT_RESUME && process.env.JOB_SCOUT_RESUME.trim()) return process.env.JOB_SCOUT_RESUME.trim();
  const file = config.profile.resumeFile && join(here, config.profile.resumeFile);
  return file && existsSync(file) ? readFileSync(file, "utf8").trim() : "";
}

const tasks = buildTasks(config.sources);
log(`Searching ${tasks.filter((t) => !t.skipped).length} sources...`);
const { jobs, report } = await fetchAll(tasks);
for (const r of report) log(`  ${r.status.padEnd(7)} ${r.name}: ${r.detail}`);

const seen = args.has("--all") ? {} : loadSeen(seenPath);
const matched = filterJobs(jobs, config, now.getTime());
const fresh = matched.filter((j) => !seen[j.id]);
log(`${jobs.length} postings, ${matched.length} match your profile, ${fresh.length} are new.`);

let results = fresh;
const resume = loadResume();
const aiUsed = !args.has("--no-ai") && Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(resume) && fresh.length > 0;
if (aiUsed) {
  log(`Asking Claude to review up to ${config.match.maxAiReviews} postings against your résumé...`);
  const { reviewed, unreviewed } = await reviewJobs(fresh, resume, { limit: config.match.maxAiReviews, log });
  results = [...reviewed, ...unreviewed];
  log(`${fresh.length - results.length} ruled out by the review.`);
} else if (!args.has("--no-ai") && fresh.length) {
  log(!process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY not set: using keyword scores only." : "No résumé found: using keyword scores only.");
}

const digest = buildDigest({ date, jobs: results, report, scanned: jobs.length, aiUsed });
mkdirSync(join(here, "out"), { recursive: true });
const digestPath = join(here, "out", `digest-${date}.md`);
writeFileSync(digestPath, digest);
writeFileSync(join(here, "out", "count.txt"), String(results.length));

// Everything that matched goes on the seen-list, including postings the
// review ruled out, so they are not reviewed (and paid for) again tomorrow.
if (!args.has("--all")) {
  for (const j of fresh) seen[j.id] = date;
  saveSeen(seenPath, seen, now);
}

log(`Digest written to ${digestPath}`);
process.stdout.write(digest);
