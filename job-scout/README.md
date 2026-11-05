# Job Scout
### Daily search for GRC and IAM roles you qualify for

Job Scout runs every morning on GitHub Actions. It pulls new postings from public job-board APIs and applies your rules. If you set an API key and add your résumé, Claude also scores each match against the résumé. New matches arrive as a GitHub issue, and GitHub emails you about it.

```
job boards ──► your rules ──► Claude fit review (optional) ──► GitHub issue ──► your inbox
```

## What it searches

| Source | What it covers | Key needed |
|---|---|---|
| Greenhouse, Lever, Ashby | Company career pages, listed in `config.json` | No |
| Remotive | Remote tech jobs | No |
| Adzuna | Aggregator that indexes Indeed, company sites, and many other boards | Free, [developer.adzuna.com](https://developer.adzuna.com/) |

Only official APIs are used. LinkedIn and Indeed forbid scraping in their terms and actively block it, so Adzuna is how Job Scout reaches those listings.

## The rules

**Where.** Remote in the US is the default and fills the **Primary** section. Hybrid anywhere in the US goes in **Secondary**. A hybrid role makes it there only if its listed pay reaches $85K, or if it lists no pay. Fully on-site roles are dropped, except internships, which go in Secondary tagged "on-site internship".

**Pay.** The floor is `payFloor` in `config.json` ($85K). A range counts as meeting the floor when its top end does. Hourly pay is converted at 2,080 hours a year.
- Remote under the floor: kept, tagged **below floor**
- Hybrid under the floor: dropped (internships are kept, tagged)
- No pay listed: kept, tagged **pay not listed**

**Titles.** GRC Analyst, Cloud GRC, Security GRC, Security Compliance Analyst, Risk and Compliance Analyst, IT Auditor, GRC Engineer I, Cybersecurity Risk Analyst, AI Governance, and entry-level IAM. IAM and GRC engineer titles with Senior, Lead, Architect, or a level of II or higher are dropped. So are manager, director, and similar titles.

**Excluded:**
- Clearance, Public Trust, background investigation, or CJIS ("no clearance required" doesn't count)
- 5+ years required (years listed as preferred don't count)
- 3+ years of hands-on ServiceNow, Wiz, or Tufin (edit `platformTools`)
- SOC, DLP, or incident-response duties (owning an incident response *plan* is fine)
- QSA, CMMC CCA, or a required CISA or CISSP ("preferred" is fine)
- Healthcare coding or billing, mortgage or banking regulatory, or procurement work, when the posting is mostly about it (a passing mention of an AML program is fine)
- SOX-only roles (SOX alongside SOC 2, NIST, ISO, and the like is fine)
- Programs only for current students
- Companies on your skip list

**Flagged, not excluded:** staffing agencies, "Senior" titles that ask for 3 or fewer years, and AI governance or automation roles. A Senior title that states no years, or more than 3, is dropped.

## What each hit shows

| Tier | Fit | Company | Title | Location | Pay | Main gap | Tags |
|---|---|---|---|---|---|---|---|
| A | 8 | Acme | GRC Analyst (link) | Remote - US | $95K-$120K | No AWS experience | |

- **Fit (1 to 10)**: Claude's score against your résumé. Without a review, it's a keyword estimate marked \* that never goes above 7.
- **Tier**: A is fit 8 or higher, B is 6 to 7, and C is 5 or lower. Pay below the floor or a staffing agency drops a hit one tier.
- **Main gap**: the biggest missing requirement, from Claude, or from the rules (for example, "asks for 4+ years").

The Claude review also checks every exclusion rule above, so it catches what keyword rules miss, such as a required CISSP written as a bullet point. Postings it rules out are logged in the workflow run but not listed.

## Skip list

Add companies you've applied to or ruled out to `skip.json`:

```json
{ "applied": ["Acme", "Globex"], "ruledOut": ["Initech"] }
```

Names match on whole words and ignore case and suffixes like "Inc.": "Acme" skips "Acme Cloud, Inc." but not "Acmeworks". This file is public. Names you'd rather keep private can go in the `JOB_SCOUT_SKIP` secret as a comma-separated list instead.

## Set up

1. **Edit `config.json`.** Replace the starter company list with your own targets, and list the certifications you hold.
2. **Add repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Purpose |
   |---|---|
   | `JOB_SCOUT_RESUME` | Your résumé as plain text. Kept as a secret so it is never committed to this public repo |
   | `ANTHROPIC_API_KEY` | Turns on the Claude review. It is billed separately from a claude.ai plan |
   | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Optional but recommended: the widest coverage |
   | `JOB_SCOUT_SKIP` | Optional: private skip list |

3. **Merge to the default branch.** GitHub runs scheduled workflows only from the default branch.
4. **Run it once by hand**: Actions → Job Scout → Run workflow. Tick "show all" on the first run to see every current match.
5. **Watch the repo** (Watch → Custom → Issues) so the issue reaches your email. To send those emails to a different address, change the routing in GitHub's notification settings.

The workflow runs daily at 12:17 UTC. To change the time, edit the `cron` line in `.github/workflows/job-scout.yml`.

## Run it locally

```bash
cd job-scout
npm install
cp ~/my-resume.txt resume.txt        # git-ignored
export ANTHROPIC_API_KEY=...         # optional
node scout.js --all                  # --all ignores the seen-list, --no-ai skips Claude
npm test
```

The digest is written to `out/digest-<date>.md`.

## Cost

The Claude review runs Claude Opus 5 at low effort on at most 25 new postings a day (`maxAiReviews`). The cost hasn't been measured on real postings yet, so check your usage in the Anthropic Console after the first few runs. To spend less, lower `maxAiReviews`. To spend nothing, leave `ANTHROPIC_API_KEY` unset. If Claude declines to review a posting, the request is retried on Anthropic's recommended fallback model.

## Adding companies

Find the board slug in the company's careers URL and add it to the matching list in `config.json`:

- `boards.greenhouse.io/<slug>` or `job-boards.greenhouse.io/<slug>` → `greenhouse`
- `jobs.lever.co/<slug>` → `lever`
- `jobs.ashbyhq.com/<slug>` → `ashby`

A wrong slug shows as ❌ under "Sources" in the digest and is skipped, so you can fix or remove it.
