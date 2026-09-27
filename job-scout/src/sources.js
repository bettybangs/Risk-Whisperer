// Fetchers for public job-board APIs. Each returns postings in one shape:
//   { id, source, company, title, location, remote, url, postedAt, description, salary }
//
// Only official, documented JSON endpoints are used. Sites such as LinkedIn
// and Indeed forbid scraping in their terms and block it, so they are
// reached indirectly through the Adzuna aggregator instead.

const TIMEOUT_MS = 20000;
const USER_AGENT = "job-scout/0.1 (personal job search; https://github.com/bettybangs/Risk-Whisperer)";

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

// Greenhouse returns description HTML with its entities escaped, so decode
// the entities first and then drop the tags.
export function htmlToText(html) {
  if (!html) return "";
  const decoded = decodeEntities(String(html));
  return decodeEntities(decoded.replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function looksRemote(...fields) {
  return fields.some((f) => /\bremote\b/i.test(String(f || "")));
}

export function normalizeGreenhouse(slug, data) {
  return (data.jobs || []).map((j) => {
    const location = j.location?.name || "";
    const description = htmlToText(j.content);
    return {
      id: `greenhouse:${slug}:${j.id}`,
      source: "Greenhouse",
      company: j.company_name || slug,
      title: j.title,
      location,
      remote: looksRemote(location),
      url: j.absolute_url,
      postedAt: j.first_published || j.updated_at || null,
      description,
      salary: null
    };
  });
}

export function normalizeLever(slug, data) {
  return (Array.isArray(data) ? data : []).map((j) => {
    const location = j.categories?.location || (j.categories?.allLocations || []).join(", ");
    const lists = (j.lists || []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n");
    return {
      id: `lever:${slug}:${j.id}`,
      source: "Lever",
      company: slug,
      title: j.text,
      location,
      remote: j.workplaceType === "remote" || looksRemote(location),
      url: j.hostedUrl,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      description: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n"),
      salary: j.salaryRange ? formatRange(j.salaryRange.min, j.salaryRange.max, j.salaryRange.interval) : null
    };
  });
}

export function normalizeAshby(slug, data) {
  return (data.jobs || []).filter((j) => j.isListed !== false).map((j) => ({
    id: `ashby:${slug}:${j.id || j.jobUrl}`,
    source: "Ashby",
    company: slug,
    title: j.title,
    location: j.location || "",
    remote: j.isRemote === true || j.workplaceType === "Remote" || looksRemote(j.location),
    url: j.jobUrl || j.applyUrl,
    postedAt: j.publishedAt || null,
    description: j.descriptionPlain || htmlToText(j.descriptionHtml),
    salary: j.compensation?.compensationTierSummary || null
  }));
}

export function normalizeRemotive(data) {
  return (data.jobs || []).map((j) => ({
    id: `remotive:${j.id}`,
    source: "Remotive",
    company: j.company_name,
    title: j.title,
    location: j.candidate_required_location || "Remote",
    remote: true,
    url: j.url,
    postedAt: j.publication_date || null,
    description: htmlToText(j.description),
    salary: j.salary || null
  }));
}

export function normalizeUsajobs(data) {
  return (data.SearchResult?.SearchResultItems || []).map((item) => {
    const d = item.MatchedObjectDescriptor || {};
    const details = d.UserArea?.Details || {};
    const pay = (d.PositionRemuneration || [])[0];
    const location = d.PositionLocationDisplay || "";
    return {
      id: `usajobs:${d.PositionID || item.MatchedObjectId}`,
      source: "USAJOBS",
      company: d.OrganizationName || d.DepartmentName || "US Government",
      title: d.PositionTitle,
      location,
      remote: details.RemoteIndicator === true || looksRemote(location),
      url: d.PositionURI,
      postedAt: d.PublicationStartDate || null,
      description: [details.JobSummary, d.QualificationSummary, (details.MajorDuties || []).join("\n"), details.SecurityClearance && `Security clearance: ${details.SecurityClearance}`]
        .filter(Boolean).join("\n"),
      salary: pay ? formatRange(pay.MinimumRange, pay.MaximumRange, pay.Description) : null
    };
  });
}

export function normalizeAdzuna(data) {
  return (data.results || []).map((j) => ({
    id: `adzuna:${j.id}`,
    source: "Adzuna",
    company: j.company?.display_name || "Unknown",
    title: htmlToText(j.title),
    location: j.location?.display_name || "",
    remote: looksRemote(j.location?.display_name, j.title, j.description),
    url: j.redirect_url,
    postedAt: j.created || null,
    description: htmlToText(j.description),
    salary: j.salary_min ? formatRange(j.salary_min, j.salary_max, "year") : null
  }));
}

function formatRange(min, max, interval) {
  const fmt = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
  const range = max && Number(max) !== Number(min) ? `${fmt(min)} - ${fmt(max)}` : fmt(min);
  return interval ? `${range} / ${String(interval).toLowerCase().replace(/^per /, "")}` : range;
}

// Build the list of fetch tasks from config.sources. Sources that need a key
// are skipped (with a note) when the key is not set.
export function buildTasks(sources, env = process.env) {
  const tasks = [];
  const maxAge = sources.maxAgeDays || 3;

  for (const slug of sources.greenhouse || []) {
    tasks.push({ name: `greenhouse/${slug}`, run: async () =>
      normalizeGreenhouse(slug, await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`)) });
  }
  for (const slug of sources.lever || []) {
    tasks.push({ name: `lever/${slug}`, run: async () =>
      normalizeLever(slug, await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`)) });
  }
  for (const slug of sources.ashby || []) {
    tasks.push({ name: `ashby/${slug}`, run: async () =>
      normalizeAshby(slug, await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`)) });
  }
  for (const term of sources.remotive || []) {
    tasks.push({ name: `remotive/${term}`, run: async () =>
      normalizeRemotive(await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=100`)) });
  }

  if (env.USAJOBS_API_KEY && env.USAJOBS_EMAIL) {
    for (const term of sources.usajobs || []) {
      const qs = new URLSearchParams({ Keyword: term, ResultsPerPage: "100", DatePosted: String(maxAge) });
      tasks.push({ name: `usajobs/${term}`, run: async () =>
        normalizeUsajobs(await getJson(`https://data.usajobs.gov/api/search?${qs}`, {
          Host: "data.usajobs.gov",
          "User-Agent": env.USAJOBS_EMAIL,
          "Authorization-Key": env.USAJOBS_API_KEY
        })) });
    }
  } else if ((sources.usajobs || []).length) {
    tasks.push({ name: "usajobs", skipped: "set USAJOBS_API_KEY and USAJOBS_EMAIL to search federal jobs" });
  }

  if (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY) {
    const country = sources.adzunaCountry || "us";
    for (const term of sources.adzuna || []) {
      const qs = new URLSearchParams({
        app_id: env.ADZUNA_APP_ID, app_key: env.ADZUNA_APP_KEY,
        what: term, results_per_page: "50", max_days_old: String(maxAge), "content-type": "application/json"
      });
      tasks.push({ name: `adzuna/${term}`, run: async () =>
        normalizeAdzuna(await getJson(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${qs}`)) });
    }
  } else if ((sources.adzuna || []).length) {
    tasks.push({ name: "adzuna", skipped: "set ADZUNA_APP_ID and ADZUNA_APP_KEY to search the wider web (Indeed, company sites, and more)" });
  }

  return tasks;
}

// Run every task, a few at a time. One failing board never stops the run;
// its error is returned in the report so a bad slug is easy to spot.
export async function fetchAll(tasks, concurrency = 6) {
  const jobs = [];
  const report = [];
  const queue = [...tasks];
  async function worker() {
    while (queue.length) {
      const task = queue.shift();
      if (task.skipped) { report.push({ name: task.name, status: "skipped", detail: task.skipped }); continue; }
      try {
        const found = await task.run();
        jobs.push(...found);
        report.push({ name: task.name, status: "ok", detail: `${found.length} postings` });
      } catch (e) {
        report.push({ name: task.name, status: "error", detail: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  // The same posting can come back from several searches.
  const unique = new Map();
  for (const job of jobs) if (job.title && job.url && !unique.has(job.id)) unique.set(job.id, job);
  return { jobs: [...unique.values()], report };
}
