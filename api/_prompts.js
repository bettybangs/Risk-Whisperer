// Server-side prompts and model settings for Risk Whisperer.
//
// Everything that shapes what Claude is told lives here, on the server. The
// browser sends only data (framework, environment, control family, the
// user's text, and earlier results); it never sends a prompt or a model name.
// Files in api/ that start with "_" are shared modules, not endpoints.

// Allowed values for the dropdowns. These must match src/options.js; a test
// in src/api.test.js fails if the two lists drift apart.
export const FRAMEWORKS = [
  "NIST SP 800-53 Rev 5",
  "NIST CSF 2.0",
  "FedRAMP Moderate",
  "FedRAMP High",
  "CIS Controls v8",
  "ISO 27001:2022",
  "SOC 2 Type I",
  "SOC 2 Type II",
  "PCI DSS v4.0",
  "HIPAA Security Rule",
  "CMMC 2.0",
  "CISA Zero Trust Maturity Model",
  "NIST SP 800-171",
  "NERC CIP",
  "GDPR"
];

export const ENVS = [
  "AWS",
  "AWS GovCloud",
  "Azure",
  "Azure Government",
  "GCP",
  "Oracle Cloud (OCI)",
  "Multi-cloud",
  "Hybrid (On-prem + Cloud)",
  "On-premises"
];

export const CONTROL_FAMILIES = [
  "Any (Auto-detect)",
  "Access Control",
  "Audit & Accountability",
  "Configuration Management",
  "Identification & Authentication",
  "Incident Response",
  "Risk Assessment",
  "System & Communications Protection",
  "System & Information Integrity",
  "Supply Chain Risk Management",
  "Physical & Environmental Protection",
  "Media Protection"
];

// The server picks the model and token budget for each call.
export const MODELS = {
  // temperature 0 makes repeat runs on the same input pick the same controls
  // far more often. (Opus 5 rejects temperature, so the judge leaves it out.)
  assess: { model: "claude-haiku-4-5-20251001", max_tokens: 6000, temperature: 0 },
  // The fit judgment needs a stronger model than the main call;
  // Haiku repeatedly misjudged which criteria cover MFA.
  judge: { model: "claude-opus-5", max_tokens: 4000, output_config: { effort: "medium" } },
  plain: { model: "claude-haiku-4-5-20251001", max_tokens: 6000 }
};

// ---- SOC 2 reference text sent to the assessment model ----

export const SOC2_TSC_REFERENCE = "Reference for SOC 2 Trust Services Criteria: use ONLY these real control numbers and topics, and do not substitute another framework's domain names: CC1.x = Control Environment, CC2.x = Communication & Information, CC3.x = Risk Assessment, CC4.x = Monitoring Activities, CC5.x = Control Activities, CC6.x = Logical & Physical Access Controls, CC7.x = System Operations (7.1 Detection of security events/vulnerabilities, 7.2 Monitoring for anomalies via defined procedures, 7.3 Evaluation of identified security incidents, 7.4 Response, containment, and communication/notification to affected parties, 7.5 Recovery from identified incidents), CC8.x = Change Management, CC9.1 = Risk mitigation for business disruptions, CC9.2 = Risk mitigation for vendor and business partner relationships, A1.x = Availability (A1.1 Capacity Planning & Forecasting, A1.2 Environmental Protections/Backup/Recovery Infrastructure, A1.3 Recovery Plan Testing), C1.x = Confidentiality, PI1.x = Processing Integrity, P1.x-P8.x = Privacy. Do NOT use ISO 27001 Annex A domain names (e.g., 'Organization of Information Security', 'Information Security Policies and Procedures') to describe SOC 2 controls, since these are a different framework.";

const SOC2_TYPE_I_GUIDANCE = " This is a SOC 2 Type I examination: it evaluates whether controls are suitably designed and implemented as of a specific date, not whether they operated effectively over time. Focus assessment questions on control design and implementation. Evidence should be point-in-time (policies, procedures, system configurations, screenshots, and a single walkthrough of the control), not samples drawn across an observation period. Do not recommend operating-effectiveness testing over a period.";

const SOC2_TYPE_II_GUIDANCE = " This is a SOC 2 Type II examination: it evaluates whether controls operated effectively throughout an observation period (typically 3-12 months). Include assessment questions about consistency of operation across the period. Evidence should include full populations and samples drawn across the observation period, not just a single point-in-time example.";

export const FRAMEWORK_REFERENCES = {
  "SOC 2 Type I": SOC2_TSC_REFERENCE + SOC2_TYPE_I_GUIDANCE,
  "SOC 2 Type II": SOC2_TSC_REFERENCE + SOC2_TYPE_II_GUIDANCE,
};

// Verified summaries of all 61 AICPA 2017 Trust Services Criteria, checked
// against the AICPA 2017 Trust Services Criteria (not the official text), plus
// a few "Do NOT" notes that keep the models from stretching a criterion past
// what it covers. Used by the assessment and the judge.
export const SOC2_GROUNDED_DEFINITIONS = {
  "CC1.1": "Shows a commitment to integrity and ethical values.",
  "CC1.2": "The board is independent from management and oversees internal control. This is specifically about board composition, independence, and oversight activity, not general management accountability or policy communication (that's CC1.1/CC1.3/CC2.2).",
  "CC1.3": "Management sets structures, reporting lines, authorities, and responsibilities, with board oversight.",
  "CC1.4": "Attracts, develops, and retains competent people.",
  "CC1.5": "Holds people accountable for their internal control responsibilities.",
  "CC2.1": "Obtains or generates and uses relevant, quality information to support internal control.",
  "CC2.2": "Communicates internal control information, objectives, and responsibilities internally.",
  "CC2.3": "Communicates with external parties about matters affecting internal control.",
  "CC3.1": "Sets objectives clearly enough to identify and assess the risks to them.",
  "CC3.2": "Identifies and analyzes risks across the entity to decide how to manage them.",
  "CC3.3": "Considers the potential for fraud when assessing risks.",
  "CC3.4": "Identifies and assesses changes that could significantly affect internal control.",
  "CC4.1": "Performs ongoing and/or separate evaluations to confirm controls are present and working.",
  "CC4.2": "Evaluates control deficiencies and reports them promptly to those responsible for fixing them, including senior management and the board.",
  "CC5.1": "Selects and develops control activities that reduce risks to acceptable levels.",
  "CC5.2": "Selects and develops general control activities over technology.",
  "CC5.3": "Puts control activities in place through policies (what is expected) and procedures (how it is done).",
  "CC6.1": "Uses logical access security software, infrastructure, and architecture to protect information assets. Includes identifying and authenticating users (such as MFA) and managing credentials. Its points of focus include identifying and authenticating users, managing identification and authentication requirements (such as multi-factor authentication), managing credentials for infrastructure and software, restricting logical access, network segmentation, and encrypting data, so MFA enforcement and credential policies map here. Do NOT map CC6.1 for internal endpoint management, internal patch management, internal software updates, or general vulnerability scanning.",
  "CC6.2": "Registers and authorizes new internal and external users before issuing credentials, and removes credentials when access is no longer authorized. MFA is not evidence of this process. This is specifically the process of registering, authorizing, and deprovisioning users; MFA enforcement or the absence of a credential type is not evidence of that process (that is CC6.1).",
  "CC6.3": "Grants, changes, and removes access based on roles and responsibilities, applying least privilege and segregation of duties.",
  "CC6.4": "Restricts physical access to facilities and protected assets, such as data centers and backup media storage, to authorized personnel.",
  "CC6.5": "Removes protections from physical assets only after the data and software on them can no longer be read or recovered.",
  "CC6.6": "Protects against threats from outside the system boundaries with logical access security measures.",
  "CC6.7": "Restricts and protects the transmission, movement, and removal of information to authorized users and processes.",
  "CC6.8": "Prevents or detects, and acts on, unauthorized or malicious software. Do NOT map CC6.8 for generic system patches or OS updates unless explicit anti-malware measures (like AV or EDR) are mentioned.",
  "CC7.1": "Uses detection and monitoring to find configuration changes that introduce vulnerabilities, and exposure to newly discovered vulnerabilities. This is specifically vulnerability and configuration-change detection, not general security incident detection (that's CC7.2/CC7.3).",
  "CC7.2": "Monitors system components for anomalies that signal malicious acts, natural disasters, or errors, and analyzes them to decide whether they are security events.",
  "CC7.3": "Evaluates security events to decide whether they are, or could become, security incidents, and acts to prevent or address them. Executing a defined incident response program is CC7.4, not CC7.3.",
  "CC7.4": "Responds to security incidents through a defined incident response program: understand, contain, remediate, and communicate.",
  "CC7.5": "Identifies, develops, and carries out activities to recover from security incidents.",
  "CC8.1": "Authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures.",
  "CC9.1": "Identifies, selects, and develops risk mitigation activities for potential business disruptions.",
  "CC9.2": "Assesses and manages risks from vendors and business partners.",
  "A1.1": "Monitors and evaluates processing capacity and usage to manage demand and add capacity when needed.",
  "A1.2": "Authorizes, implements, operates, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure.",
  "A1.3": "Tests recovery plan procedures that support system recovery.",
  "C1.1": "Identifies and maintains confidential information. Do NOT map C1.1 for routine data destruction, wiping, or disposal procedures unless asset identification/classification inventories are explicitly described.",
  "C1.2": "Disposes of confidential information. This is specifically about the disposal/destruction of confidential information: the physical or logical process of removing it so it can no longer be accessed. Do NOT frame this control around who is authorized to access confidential information, access permissions, or authorization requirements, which is a different control (access control / authorization), not C1.2. C1.2 is strictly about the act of destroying/disposing of data once it's no longer needed.",
  "PI1.1": "Obtains, uses, and communicates relevant, quality information about processing objectives, including data definitions and product or service specifications.",
  "PI1.2": "Applies policies and procedures over system inputs, including completeness and accuracy controls.",
  "PI1.3": "Applies policies and procedures over system processing so results meet objectives.",
  "PI1.4": "Delivers or makes output available completely, accurately, and on time according to specifications.",
  "PI1.5": "Stores inputs, in-process items, and outputs completely, accurately, and on time according to system specifications.",
  "P1.1": "Gives data subjects notice of its privacy practices and updates them promptly when practices change.",
  "P2.1": "Communicates choices about the collection, use, retention, disclosure, and disposal of personal information and the consequences of each choice. Gets explicit consent when required, only for the intended purpose, and documents its basis for implicit consent.",
  "P3.1": "Collects personal information consistent with its privacy objectives.",
  "P3.2": "For information that needs explicit consent, explains why consent is needed and the consequences of refusing, and gets consent before collecting.",
  "P4.1": "Limits the use of personal information to the purposes in its privacy objectives.",
  "P4.2": "Retains personal information consistent with its privacy objectives.",
  "P4.3": "Securely disposes of personal information.",
  "P5.1": "Lets identified and authenticated data subjects access their personal information for review, provides copies on request, and explains any denial.",
  "P5.2": "Corrects, amends, or appends personal information based on data subjects' input, passes changes to third parties as committed or required, and explains any denial.",
  "P6.1": "Discloses personal information to third parties only with the data subject's explicit consent, obtained before disclosure.",
  "P6.2": "Keeps a complete, accurate, and timely record of authorized disclosures.",
  "P6.3": "Keeps a complete, accurate, and timely record of detected or reported unauthorized disclosures, including breaches.",
  "P6.4": "Obtains privacy commitments from vendors and third parties with access to personal information, and periodically checks their compliance.",
  "P6.5": "Obtains commitments from vendors and third parties to notify the entity of actual or suspected unauthorized disclosures, and acts on those notices.",
  "P6.6": "Notifies affected data subjects, regulators, and others of breaches and incidents.",
  "P6.7": "Gives data subjects, on request, an accounting of the personal information held about them and how it was disclosed.",
  "P7.1": "Collects and maintains accurate, up-to-date, complete, and relevant personal information.",
  "P8.1": "Has a process to receive, address, resolve, and report back on privacy inquiries, complaints, and disputes, and periodically monitors compliance and fixes deficiencies promptly."
};

// Added to every system prompt. The server also replaces any em-dash that
// still appears in a response (see replaceEmDashes in api/_claude.js).
export const NO_EM_DASH_RULE = " Never use em-dashes (the long dash, Unicode U+2014) anywhere in your output text. Use commas, colons, periods, or parentheses instead.";

// ---- Assessment (Haiku) ----

export function buildAssessRequest({ framework, env, family, input }) {
  var familyHint = family !== "Any (Auto-detect)" ? " Focus on the " + family + " control family." : "";
  // Give the model a verified summary of every SOC 2 criterion so it picks
  // IDs by what each criterion covers instead of guessing from the number.
  var soc2CriteriaHint = framework.startsWith("SOC 2")
    ? " Verified summaries of the AICPA 2017 Trust Services Criteria for every SOC 2 criterion. Choose controlMappings IDs only from this list, by matching what the input describes against what each criterion actually covers:\n" +
      Object.keys(SOC2_GROUNDED_DEFINITIONS).map(function(id) { return id + ": " + SOC2_GROUNDED_DEFINITIONS[id]; }).join("\n") + "\n"
    : "";
  return {
    ...MODELS.assess,
    system: "You are a senior GRC analyst and security control assessor specializing in " + env + " cloud environments and " + framework + " compliance." + familyHint + (FRAMEWORK_REFERENCES[framework] ? " " + FRAMEWORK_REFERENCES[framework] : "") + soc2CriteriaHint + " Return ONLY valid JSON (no markdown, no backticks) with these exact keys: assessmentQuestions (array of 6-8 specific interview questions an auditor would ask), evidenceToCollect (array of 6-8 specific artifacts/screenshots/logs to request), potentialWeaknesses (array of 4-6 objects with {name, description, severity, recommendation} where severity is High/Medium/Low), controlMappings (array of 1-6 objects with {id, name, rationale}, using control identifiers native to the selected framework (e.g., CC-series like CC6.1 for SOC 2, Annex A numbering like A.9.4.2 for ISO 27001, requirement numbers like 8.3 for PCI DSS, AC-2 style IDs only for NIST-based frameworks), and never default to NIST numbering for a non-NIST framework. STRICT INCLUSION RULE: only include a control if the input text directly and specifically describes an activity, system, or process that control governs. Do NOT include a control because it is commonly associated with the topic, because a related control might also be relevant, or because the organization 'should' or 'must' also have that control in place: if the input doesn't describe it, leave it out. Do NOT include a control based on an inferred gap or missing control ('no evidence of X' is a reason to exclude, not include). Every rationale must cite the specific words or facts from the input that justify that control's inclusion: if you cannot point to something explicitly stated in the input, do not include the control.), overallRiskScore (a number 1-10 where 10 is highest risk), riskJustification (2-3 sentence explanation of the score), controlMaturity (one of: Initial/Developing/Defined/Managed/Optimizing), maturityJustification (1-2 sentence explanation). Be specific to " + env + " services and " + framework + " requirements." + NO_EM_DASH_RULE,
    messages: [{ role: "user", content: "Assess this security control:\n\n" + input }]
  };
}

// ---- Judge (Opus 5) ----

// Which mapped controls the judge checks: those with a verified definition,
// and for SOC 2, every mapped control (judged from the model's own knowledge
// when no verified definition exists, and flagged as such).
export function selectControlsToJudge(framework, controlMappings) {
  return controlMappings.filter(function(c) {
    return SOC2_GROUNDED_DEFINITIONS[c.id] || framework.startsWith("SOC 2");
  });
}

export function isVerifiedControl(id) {
  return Object.prototype.hasOwnProperty.call(SOC2_GROUNDED_DEFINITIONS, id);
}

export function buildJudgeRequest({ input, controls }) {
  var defsText = controls.map(function(c) {
    return SOC2_GROUNDED_DEFINITIONS[c.id]
      ? c.id + ": " + SOC2_GROUNDED_DEFINITIONS[c.id]
      : c.id + ": (no verified definition: judge fit from your knowledge of the 2017 Trust Services Criteria)";
  }).join("\n");
  return {
    ...MODELS.judge,
    system: "You are a precise GRC writer. For each control below, you are given its definition from verified summaries of the AICPA 2017 Trust Services Criteria (or, where none is available, a note saying so), plus the situation being assessed. Write a 1-2 sentence rationale for each control using ONLY what its definition actually covers. If the definition includes a 'Do NOT' instruction, you must not include that excluded concept anywhere in your rationale, even in passing or as a secondary point: treat it as a hard constraint, not a style preference. Also judge whether each control is a good fit. Judge by the substance of the definition, not its exact wording: an activity that clearly falls within the definition's scope counts even if the definition does not name it. Set relevant to false only if the situation does not describe anything the definition governs, if the control is merely associated with the topic, or if it would only apply because of a missing or undocumented process; otherwise set relevant to true. When relevant is false, the rationale must be one sentence explaining what the definition covers that the situation does not describe. Return ONLY valid JSON (no markdown, no backticks): an array of objects with keys {id, relevant, rationale}, where relevant is a boolean." + NO_EM_DASH_RULE + "\n\nControl definitions:\n" + defsText,
    messages: [{ role: "user", content: "Situation being assessed:\n\n" + input }]
  };
}

// ---- Plain Talk (Haiku) ----

export function buildPlainRequest({ result }) {
  return {
    ...MODELS.plain,
    system: "You are a communication specialist who translates technical GRC security findings into plain business language. Return ONLY valid JSON (no markdown, no backticks) with these exact keys: assessmentQuestionsPlain (array of the same number of questions rewritten in plain language for a non-technical business audience, no jargon or control IDs), evidenceToCollectPlain (array of the same evidence items rewritten in plain language a business stakeholder would understand), potentialWeaknessesPlain (array of the same weaknesses as objects with {name, description, severity, recommendation} rewritten in plain business language explaining business risk and impact, no technical jargon), riskJustificationPlain (risk explanation rewritten for a business executive with no GRC background), maturityJustificationPlain (maturity explanation in plain business language)." + NO_EM_DASH_RULE,
    messages: [{ role: "user", content: "Translate these GRC findings into plain business language:\n\n" + JSON.stringify(result) }]
  };
}
