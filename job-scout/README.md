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

**Where.** Remote in the US is the default and fills the **Primary** section. Hybrid anywhere in the US goes in **Secondary**. A hybrid role makes it there only if its listed pay reaches $85K, or if it lists no pay. Fully on-site roles are dropped, except internships, which go in Secondary tagged "on-site internship". A posting that never says whether it is remote, hybrid, or on-site is kept in a third section, **Location unclear**, below Secondary, so you can check it by hand.

**Pay.** The floor is `payFloor` in `config.json` ($85K). A range counts as meeting the floor when its top end does. Hourly pay is converted at 2,080 hours a year.
- Remote or location unclear, under the floor: kept, tagged **below floor**
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
- Companies and postings on your skip list (see below)

**Flagged, not excluded:** staffing agencies, "Senior" titles that ask for 3 or fewer years, and AI governance or automation roles. A Senior title that states no years, or more than 3, is dropped.

## What each hit shows

| Tier | Fit | Company | Title | Location | Pay | Main gap | Tags |
|---|---|---|---|---|---|---|---|
| A | 8 | Acme | GRC Analyst (link) | Remote - US | $95K-$120K | No AWS experience | |

- **Fit (1 to 10)**: Claude's score against your résumé. Without a review, it's a keyword estimate marked \* that never goes above 7.
- **Tier**: A is fit 8 or higher, B is 6 to 7, and C is 5 or lower. Pay below the floor or a staffing agency drops a hit one tier.
- **Main gap**: the biggest missing requirement, from Claude, or from the rules (for example, "asks for 4+ years").
- **Keyword score**: matched skills add 1 point each. Each of your certifications that a posting mentions adds 2 (the short form counts, e.g. "Security+" for CompTIA Security+), and a posting that asks for a degree in your field (Cybersecurity or Information Assurance) adds 2. Both are set in `config.json` under `profile`.

Sections are listed in order: Primary, then Secondary, then Location unclear. The Claude review budget goes to Primary first.

The bottom of every issue shows how many postings were sent to the Claude review, the tokens used, and an estimated cost at Claude Opus 5 list prices. If the review spends tokens but rules everything out, an issue still opens, so the spend stays visible.

The Claude review also checks every exclusion rule above, so it catches what keyword rules miss, such as a required CISSP written as a bullet point. Postings it rules out are logged in the workflow run but not listed.

## Skip list

The daily workflow reads the skip list from the `JOB_SCOUT_SKIP` secret. Local runs fall back to `skip.json`, which is git-ignored so your real list never lands in this public repo. Copy `skip.example.json` to get started:

```json
{
  "skip_companies": ["Example Staffing Co"],
  "skip_postings": [
    { "company": "Acme", "title": "GRC Analyst", "status": "applied", "added": "2026-11-01", "expires_days": 45 }
  ],
  "tag_companies": ["Globex"]
}
```

| List | What it does |
|---|---|
| `skip_companies` | Every posting from the company is dropped, with no expiry |
| `skip_postings` | Matches the company plus a title keyword. `"status": "ruled_out"` never expires. `"status": "applied"` is dropped until `expires_days` after `added` (YYYY-MM-DD). After that, the posting shows up once more, tagged **previously applied** |
| `tag_companies` | Postings are kept and tagged **prior history** |

Company names match on whole words and ignore case and suffixes like "Inc.": "Acme" matches "Acme Cloud, Inc." but not "Acmeworks". The title keyword is a whole-word match, so "GRC Analyst" also matches "Senior GRC Analyst". A mistake in the list, such as a date in the wrong format, stops the run with a message naming the entry. GitHub emails you when a workflow run fails.

To update the secret, paste the whole JSON into Settings → Secrets and variables → Actions → `JOB_SCOUT_SKIP`. When the secret is set, `skip.json` is ignored.

## Set up

1. **Edit `config.json`.** Replace the starter company list with your own targets. Your certifications and degree are already filled in under `profile`.
2. **Add repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Purpose |
   |---|---|
   | `JOB_SCOUT_RESUME` | Your résumé as plain text. Kept as a secret so it is never committed to this public repo |
   | `ANTHROPIC_API_KEY` | Turns on the Claude review. It is billed separately from a claude.ai plan |
   | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Optional but recommended: the widest coverage |
   | `JOB_SCOUT_SKIP` | Optional: your skip list, as JSON (see Skip list) |

3. **Merge to the default branch.** GitHub runs scheduled workflows only from the default branch.
4. **Run it once by hand**: Actions → Job Scout → Run workflow. Tick "show all" on the first run to see every current match.
5. **Watch the repo** (Watch → Custom → Issues) so the issue reaches your email. To send those emails to a different address, change the routing in GitHub's notification settings.

The workflow runs daily at 12:17 UTC. To change the time, edit the `cron` line in `.github/workflows/job-scout.yml`.

## Run it locally

```bash
cd job-scout
npm install
cp ~/my-resume.txt resume.txt        # git-ignored
cp skip.example.json skip.json       # git-ignored; edit it
export ANTHROPIC_API_KEY=...         # optional
node scout.js --all                  # --all ignores the seen-list, --no-ai skips Claude
npm test
```

The digest is written to `out/digest-<date>.md`.

## Cost

The Claude review runs Claude Opus 5 at low effort on at most 25 new postings a day (`maxAiReviews`). The cost hasn't been measured on real postings yet, so watch the spend line at the bottom of each issue, and check your usage in the Anthropic Console after the first few runs. To spend less, lower `maxAiReviews`. To spend nothing, leave `ANTHROPIC_API_KEY` unset. If Claude declines to review a posting, the request is retried on Anthropic's recommended fallback model.

## Adding companies

Find the board slug in the company's careers URL and add it to the matching list in `config.json`:

- `boards.greenhouse.io/<slug>` or `job-boards.greenhouse.io/<slug>` → `greenhouse`
- `jobs.lever.co/<slug>` → `lever`
- `jobs.ashbyhq.com/<slug>` → `ashby`

A wrong slug shows as ❌ under "Sources" in the digest and is skipped, so you can fix or remove it.
