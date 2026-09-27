# Job Scout
### Daily search for GRC and IAM roles you qualify for

Job Scout runs every morning on GitHub Actions. It pulls new postings from public job-board APIs, keeps the ones that match your profile, and optionally has Claude compare each one with your résumé. The matches arrive as a GitHub issue, and GitHub emails you about it.

```
job boards ──► keyword filter ──► Claude fit review (optional) ──► GitHub issue ──► your inbox
```

## What it searches

| Source | What it covers | Key needed |
|---|---|---|
| Greenhouse, Lever, Ashby | Company career pages (Okta, Cloudflare, Vanta, Drata, and others in `config.json`) | No |
| Remotive | Remote tech jobs | No |
| USAJOBS | Federal roles (ISSO, RMF, IAM) | Free, [developer.usajobs.gov](https://developer.usajobs.gov/APIRequest/) |
| Adzuna | Aggregator that indexes Indeed, company sites, and many other boards | Free, [developer.adzuna.com](https://developer.adzuna.com/) |

Only official APIs are used. LinkedIn and Indeed forbid scraping in their terms and actively block it, so Adzuna is how Job Scout reaches those listings.

## How it decides what you qualify for

1. **Keyword filter** (always runs, free). The title must contain a GRC or IAM term and none of the excluded terms (director, sales, credit risk, and so on). Postings that require a clearance you don't hold are dropped. So are postings that ask for more than 3 years beyond your experience; a smaller gap is flagged instead. Each skill or certification from your lists that appears in the posting raises its score.
2. **Claude fit review** (runs when `ANTHROPIC_API_KEY` and a résumé are set). Claude Opus 5 reads up to 25 of the best-scoring new postings next to your résumé. It rates each one strong, good, stretch, or no, and lists what you meet and what you lack. "No" matches are dropped. If a review fails, the posting is still listed, just without a rating.
3. **Seen-list.** A posting is reported once. The list is kept in the Actions cache, and a role re-posted after 60 days shows up again.

## Set up (about 10 minutes)

1. **Edit `config.json`**: set your years of experience, clearance, certifications, and locations, and adjust the title and skill keywords.
2. **Add repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Purpose |
   |---|---|
   | `JOB_SCOUT_RESUME` | Your résumé as plain text. Kept as a secret so it is never committed to this public repo |
   | `ANTHROPIC_API_KEY` | Enables the Claude fit review (the same key Risk Whisperer uses) |
   | `USAJOBS_API_KEY`, `USAJOBS_EMAIL` | Optional: federal jobs |
   | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Optional but recommended: the widest coverage |

3. **Merge to the default branch.** GitHub runs scheduled workflows only from the default branch.
4. **Run it once by hand**: Actions → Job Scout → Run workflow. Tick "show all" on the first run to see every current match.
5. Make sure you're watching the repo (Watch → All activity, or Custom → Issues) so the issue reaches your email.

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

The Claude review runs on at most 25 new postings a day (`maxAiReviews`) at low effort, which usually costs a few cents a day. Lower `maxAiReviews`, or leave `ANTHROPIC_API_KEY` unset, to spend less or nothing. If Claude declines to review a posting, the request is retried on Anthropic's recommended fallback model (`fallbacks: "default"`).

## Adding companies

Find the board slug in the company's careers URL and add it to the matching list in `config.json`:

- `boards.greenhouse.io/<slug>` or `job-boards.greenhouse.io/<slug>` → `greenhouse`
- `jobs.lever.co/<slug>` → `lever`
- `jobs.ashbyhq.com/<slug>` → `ashby`

The starter list has not been checked against every company's current board. A wrong slug shows as ❌ under "Sources" in the digest and is skipped, so you can fix or remove it.
