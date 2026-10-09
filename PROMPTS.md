# Prompt Engineering Strategy: Risk Whisperer

## Overview

Risk Whisperer uses a structured prompting approach to get Claude to behave like a senior GRC analyst, returning consistent, audit-ready outputs every time. This document explains the key decisions behind the prompt design.

All prompts live on the server in `api/_prompts.js`. The browser sends only data, and the server builds the prompt, picks the model, and sets `max_tokens`.

| Call | Endpoint | Browser sends | Model | max_tokens |
|---|---|---|---|---|
| Assessment | `/api/assess` | `{ framework, env, family, input }` | Claude Haiku 4.5, temperature 0 | 6000 |
| Judge | `/api/judge` | `{ framework, input, controlMappings }` | Claude Opus 5, medium effort | 4000 |
| Plain Talk | `/api/plain` | `{ result }` | Claude Haiku 4.5 | 6000 |

## The Assessment Prompt (Haiku 4.5)

The assessment system prompt does six things.

### 1. Role Assignment

Claude is told to act as a senior GRC analyst and security control assessor for the selected cloud environment and compliance framework:

> "You are a senior GRC analyst and security control assessor specializing in {env} cloud environments and {framework} compliance."

A specific professional role produces more authoritative, domain-accurate outputs than a generic prompt.

### 2. Dynamic Context Injection

The framework, cloud environment, and optional control family are injected at runtime. The same prompt engine produces HIPAA-specific outputs for healthcare and FedRAMP-specific outputs for government without a separate prompt for each. One prompt covers 15 frameworks and 9 environments.

> "Be specific to {env} services and {framework} requirements."

### 3. SOC 2 Grounding (Type I and Type II)

For SOC 2, the prompt adds:

- A reference to the real Trust Services Criteria numbering (CC1 through CC9, A1, C1, PI1, P1 through P8), with a warning not to borrow ISO 27001 Annex A domain names.
- Examination guidance. **SOC 2 Type I** evaluates whether controls are suitably designed and implemented as of a point in time, so questions focus on design and evidence is point-in-time. **SOC 2 Type II** evaluates operating effectiveness over an observation period, so questions cover consistency over time and evidence includes populations and samples across the period.
- Verified summaries of the AICPA 2017 Trust Services Criteria for all 61 criteria, with the instruction to choose `controlMappings` IDs only from that list, by matching what the input describes against what each criterion covers.

### 4. Structured JSON Output

Claude returns only valid JSON with exact key names. No markdown, no backticks, no preamble:

- `assessmentQuestions` (array of 6-8 strings)
- `evidenceToCollect` (array of 6-8 strings)
- `potentialWeaknesses` (array of 4-6 objects with `{name, description, severity, recommendation}`)
- `controlMappings` (array of 1 to 6 objects with `{id, name, rationale}`, using identifiers native to the selected framework)
- `overallRiskScore` (number 1-10)
- `riskJustification` (string)
- `controlMaturity` (one of Initial, Developing, Defined, Managed, Optimizing)
- `maturityJustification` (string)

The mapping key is `controlMappings`, not `nistControls`, because IDs must be native to the chosen framework: CC6.1 for SOC 2, A.9.4.2 for ISO 27001, 8.3 for PCI DSS, and AC-2 style IDs only for NIST-based frameworks.

### 5. Strict Inclusion Rule

Only include a control if the input directly and specifically describes an activity, system, or process that control governs. Do not include a control because it is commonly associated with the topic, because a related control might apply, or because the organization "should" have it. An inferred gap ("no evidence of X") is a reason to exclude, not include. Every rationale must cite specific words or facts from the input. This is why the prompt asks for 1 to 6 mappings rather than a fixed minimum: forcing a minimum count pushed the model to pad the list with loosely related controls.

Haiku still sometimes lists a control and then hedges in its own rationale ("cannot be fully mapped", "not included here"). Asking it to re-read and delete those controls was tried and did not work: the model writes its answer in one pass and does not go back and remove what it already wrote. Catching these is the judge's job, and it flags them as weak fits.

### 5a. Consistency

Early testing showed the same input could produce different mappings from run to run (CC6.1 in one run, CC7.1 in another). Three changes address this:

- **Temperature 0** on the assessment call, so repeat runs on the same input pick the same controls far more often. The judge runs on Opus 5, which does not accept a temperature setting.
- **CC6.1 points of focus.** The CC6.1 definition now notes its AICPA points of focus, including managing identification and authentication (such as multi-factor authentication) and managing credentials, so MFA enforcement maps to CC6.1.
- **CC6.2 boundary.** The CC6.2 definition now says it covers the process of registering, authorizing, and removing users, and that MFA enforcement is not evidence of that process.

Both definition notes are read by the assessment and the judge.

### 6. Severity Constraints

`severity` is limited to High, Medium, or Low. Values like "Critical" or "Informational" would break the color coding in the UI.

### 7. No Em-Dashes

All three system prompts (assessment, judge, and Plain Talk) end with the same rule: never use em-dashes, and use commas, colons, periods, or parentheses instead. The prompt wording itself contains no em-dashes either, so the model is not shown the style it is told to avoid. As a safety net, the server replaces any em-dash still left in a parsed response before returning it (`replaceEmDashes` in `api/_claude.js`): a dash between words becomes a comma and a space, a dash next to other punctuation is dropped so punctuation is never doubled, and a dash at the start or end of a string is removed.

## The Judge Call (Opus 5)

After the assessment, the app sends the mapped controls to `/api/judge` in a separate request. The judge runs on Claude Opus 5 with medium effort and 4000 max tokens, because Haiku repeatedly misjudged which criteria cover MFA.

- **Grounded in verified summaries.** For each control, the judge receives its verified summary of the AICPA 2017 Trust Services Criteria. All 61 criteria are available. A few definitions carry "Do NOT" notes (for example, CC6.8 is not about generic OS patching unless anti-malware is mentioned), and the judge must treat those as hard constraints.
- **What gets judged.** For SOC 2, every mapped control is judged. A control with no verified summary is judged from the model's own knowledge of the criteria. For other frameworks, only controls that have a verified SOC 2 summary are judged, so most non-SOC 2 assessments need no model call.
- **Output.** A JSON array of `{id, relevant, rationale}`. The judge reads the definition by substance, not exact wording, and sets `relevant` to false only if the input describes nothing the criterion governs, if the control is merely associated with the topic, or if it would apply only because of a missing process.
- **Flag, never delete.** A control with `relevant: false` stays in the list with a ⚠ Weak fit note explaining what the criterion covers that the input does not describe. Nothing is silently removed.
- **Verified vs AI-generated.** The server marks each judgment as verified only when a verified summary exists; the model cannot claim that. Only verified controls may have their rationale replaced by the judge's version. A weak fit on an unverified control is labeled "judged without a verified definition". Separately, each SOC 2 mapping shows "Control name verified · explanation AI-generated" when its display name comes from the app's AICPA-checked name table, or "Control name AI-generated, not yet verified against source" otherwise.
- **Graceful fallback.** If the judge call fails for any reason, the assessment is shown with its original rationales.

## The Plain Talk Prompt (Haiku 4.5)

When the user switches to Plain Talk, `/api/plain` sends the assessment to a communication-specialist prompt that rewrites questions, evidence, weaknesses, and justifications for a non-technical audience, with no jargon or control IDs. The result is cached in the browser, so switching back and forth does not call the model again.

## Why This Approach Works

| Decision | Reason |
|---|---|
| System prompt vs user message | Role and output format go in the system prompt; the control description goes in the user message. This keeps concerns separated. |
| Dynamic injection | One prompt handles 15 frameworks and 9 environments without branching logic. |
| JSON-only output | The response goes straight into React state with no complex parsing. |
| Constrained enum values | Unexpected values cannot break UI rendering logic. |
| Temperature 0 for the assessment | Repeat runs on the same input produce the same mappings far more often. |
| 6000 max tokens for assessment and Plain Talk | Enough for the full structured output, including the SOC 2 criteria text in the prompt, without truncation. |
| A separate, stronger judge | A second model checking against verified summaries of the AICPA 2017 Trust Services Criteria catches mappings the first model stretched. |
| Separate endpoints | Each request makes one model call, so each stays within the 60-second function limit. |

## Security

Prompts are built on the server so that the browser cannot change what Claude is told or which model runs.

- The browser sends only data. Requests containing `system`, `model`, `max_tokens`, or any other unexpected field are rejected.
- `framework`, `env`, and `family` must be on the allowed lists. `input` is limited to 5,000 characters. `controlMappings` must be an array of at most 6 items with exactly `id`, `name`, and `rationale`. The Plain Talk `result` must match the assessment's shape.
- The prompt-injection patterns run on the server as well as in the browser.
- Only POST requests with a JSON body are accepted, and only from riskwhisperer.vercel.app, this project's own `*.vercel.app` previews, and localhost in development.
- Errors come back as `{ "error": { "message": "..." } }`, which the app displays.

See the comment block at the top of `api/_security.js` for the reasoning behind each protection.

## Lessons Learned

- **Be explicit about what you don't want.** "No markdown, no backticks" was necessary, because Claude defaults to wrapping JSON in code fences.
- **Name your keys exactly.** Vague instructions like "return a list of questions" produce inconsistent key names across responses.
- **Inject context, don't repeat prompts.** Dynamic injection kept the codebase clean and the prompt maintainable.
- **Constrain open-ended fields.** Any field that drives UI logic (colors, labels) needs an explicit list of allowed values.
- **Ground the model in the source.** Giving the model verified summaries of the AICPA 2017 Trust Services Criteria works better than trusting it to recall what a control number means.
- **Flag, don't filter.** Showing a weak fit with an explanation keeps the reviewer in control and makes model mistakes visible.
