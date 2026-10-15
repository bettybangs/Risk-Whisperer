# Plain Talk

Paste a technical description, get it back in plain language, then run an optional check that flags anything the translation dropped, softened, or added. Also works in reverse (plain to technical).

Extracted from the Plain Talk view in Risk Whisperer. No framework and no build step: static files in `public/` plus two serverless functions in `api/`, deployable to Vercel as is.

## Run it

```
cp .env.example .env     # add ANTHROPIC_API_KEY
npm run dev              # http://localhost:3000
npm test
```

## Layout

| Path | Purpose |
|---|---|
| `api/translate.js` | `POST {text, audience, mode, length, industry}` returns `{summary, plain, glossary, flags}` |
| `api/verify.js` | `POST {original, translation, industry?}` returns `{faithful, issues}`; opt-in, uses a stronger model |
| `api/_prompts.js` | All prompts, option lists, and model choices (server side only) |
| `api/_security.js` | Method, origin, content-type, and field checks |
| `api/_claude.js` | Anthropic call, timeout, error mapping, JSON parsing |
| `public/` | The UI (text set with `textContent` only, so model output cannot inject markup) |
| `dev-server.js` | Local server that mounts `api/` without a Vercel login |

## Industry modes

General, Security findings, Legal & contracts, Software release notes, Insurance & finance, and Healthcare education. Each is one entry in `INDUSTRY_GUIDE` in `api/_prompts.js` (translation rules plus a list of what the verifier must not let slip) and one `<option>` in `public/index.html`; a test fails if the two drift apart. Healthcare mode is for education and policy text only, not patient data.

## Differences from Risk Whisperer's Plain Talk

- Input is free text (20,000 characters), not an assessment object.
- No keyword-based injection screen. This tool's input is security writing, so words like "leak" and "expose" are normal. Text goes to the model inside `<document>` tags with an instruction to treat it as material, not commands.
- Translation runs on submit, not lazily on a tab click.
- Verification is a separate call and endpoint.

## Before going public

- Set `ALLOWED_ORIGINS` to your production domain.
- Add rate limiting or auth. The origin check does not stop scripts outside a browser.
- Decide your data-retention promise. Nothing is stored today; keep it that way if you want to say so.
- For healthcare or other regulated text, do not send real patient data until you have a BAA with the model provider and the other compliance work done.
- Chunk very long documents (currently one call, capped at 20,000 characters).
