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

// Official AICPA 2017 Trust Services Criteria text (TSP Section 100) for all
// 61 criteria, plus a few "Do NOT" notes that keep the models from stretching
// a criterion past what it covers. Used by the assessment and the judge.
export const SOC2_GROUNDED_DEFINITIONS = {
  "CC1.1": "The entity demonstrates a commitment to integrity and ethical values.",
  "CC1.2": "The board of directors demonstrates independence from management and exercises oversight of the development and performance of internal control. This is specifically about board composition, independence, and oversight activity, not general management accountability or policy communication (that's CC1.1/CC1.3/CC2.2).",
  "CC1.3": "Management establishes, with board oversight, structures, reporting lines, and appropriate authorities and responsibilities in the pursuit of objectives.",
  "CC1.4": "The entity demonstrates a commitment to attract, develop, and retain competent individuals in alignment with objectives.",
  "CC1.5": "The entity holds individuals accountable for their internal control responsibilities in the pursuit of objectives.",
  "CC2.1": "The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.",
  "CC2.2": "The entity internally communicates information, including objectives and responsibilities for internal control, necessary to support the functioning of internal control.",
  "CC2.3": "The entity communicates with external parties regarding matters affecting the functioning of internal control.",
  "CC3.1": "The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks relating to objectives.",
  "CC3.2": "The entity identifies risks to the achievement of its objectives across the entity and analyzes risks as a basis for determining how the risks should be managed.",
  "CC3.3": "The entity considers the potential for fraud in assessing risks to the achievement of objectives.",
  "CC3.4": "The entity identifies and assesses changes that could significantly impact the system of internal control.",
  "CC4.1": "The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether the components of internal control are present and functioning.",
  "CC4.2": "The entity evaluates and communicates internal control deficiencies in a timely manner to those parties responsible for taking corrective action, including senior management and the board of directors, as appropriate.",
  "CC5.1": "The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives to acceptable levels.",
  "CC5.2": "The entity also selects and develops general control activities over technology to support the achievement of objectives.",
  "CC5.3": "The entity deploys control activities through policies that establish what is expected and in procedures that put policies into action.",
  "CC6.1": "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives. Its points of focus include identifying and authenticating users, managing identification and authentication requirements (such as multi-factor authentication), managing credentials for infrastructure and software, restricting logical access, network segmentation, and encrypting data, so MFA enforcement and credential policies map here. Do NOT map CC6.1 for internal endpoint management, internal patch management, internal software updates, or general vulnerability scanning.",
  "CC6.2": "Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity. For those users whose access is administered by the entity, user system credentials are removed when user access is no longer authorized. This is specifically the process of registering, authorizing, and deprovisioning users; MFA enforcement or the absence of a credential type is not evidence of that process (that is CC6.1).",
  "CC6.3": "The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, or the system design and changes, giving consideration to the concepts of least privilege and segregation of duties, to meet the entity's objectives.",
  "CC6.4": "The entity restricts physical access to facilities and protected information assets (for example, data center facilities, backup media storage, and other sensitive locations) to authorized personnel to meet the entity's objectives.",
  "CC6.5": "The entity discontinues logical and physical protections over physical assets only after the ability to read or recover data and software from those assets has been diminished and is no longer required to meet the entity's objectives.",
  "CC6.6": "The entity implements logical access security measures to protect against threats from sources outside its system boundaries.",
  "CC6.7": "The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes, and protects it during transmission, movement, or removal to meet the entity's objectives.",
  "CC6.8": "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software to meet the entity's objectives. Do NOT map CC6.8 for generic system patches or OS updates unless explicit anti-malware measures (like AV or EDR) are mentioned.",
  "CC7.1": "To meet its objectives, the entity uses detection and monitoring procedures to identify (1) changes to configurations that result in the introduction of new vulnerabilities, and (2) susceptibilities to newly discovered vulnerabilities. This is specifically vulnerability and configuration-change detection, not general security incident detection (that's CC7.2/CC7.3).",
  "CC7.2": "The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity's ability to meet its objectives; anomalies are analyzed to determine whether they represent security events.",
  "CC7.3": "The entity evaluates security events to determine whether they could or have resulted in a failure of the entity to meet its objectives (security incidents) and, if so, takes actions to prevent or address such failures. Executing a defined incident response program is CC7.4, not CC7.3.",
  "CC7.4": "The entity responds to identified security incidents by executing a defined incident-response program to understand, contain, remediate, and communicate security incidents, as appropriate.",
  "CC7.5": "The entity identifies, develops, and implements activities to recover from identified security incidents.",
  "CC8.1": "The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.",
  "CC9.1": "The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.",
  "CC9.2": "The entity assesses and manages risks associated with vendors and business partners.",
  "A1.1": "The entity maintains, monitors, and evaluates current processing capacity and use of system components (infrastructure, data, and software) to manage capacity demand and to enable the implementation of additional capacity to help meet its objectives.",
  "A1.2": "The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure to meet its objectives.",
  "A1.3": "The entity tests recovery plan procedures supporting system recovery to meet its objectives.",
  "C1.1": "The entity identifies and maintains confidential information to meet the entity\u2019s objectives related to confidentiality. Do NOT map C1.1 for routine data destruction, wiping, or disposal procedures unless asset identification/classification inventories are explicitly described.",
  "C1.2": "The entity disposes of confidential information to meet the entity\u2019s objectives related to confidentiality. This is specifically about the disposal/destruction of confidential information: the physical or logical process of removing it so it can no longer be accessed. Do NOT frame this control around who is authorized to access confidential information, access permissions, or authorization requirements, which is a different control (access control / authorization), not C1.2. C1.2 is strictly about the act of destroying/disposing of data once it's no longer needed.",
  "PI1.1": "The entity obtains or generates, uses, and communicates relevant, quality information regarding the objectives related to processing, including definitions of data processed and product and service specifications, to support the use of products and services.",
  "PI1.2": "The entity implements policies and procedures over system inputs, including controls over completeness and accuracy, to result in products, services, and reporting to meet the entity's objectives.",
  "PI1.3": "The entity implements policies and procedures over system processing to result in products, services, and reporting to meet the entity's objectives.",
  "PI1.4": "The entity implements policies and procedures to make available or deliver output completely, accurately, and timely in accordance with specifications to meet the entity's objectives.",
  "PI1.5": "The entity implements policies and procedures to store inputs, items in processing, and outputs completely, accurately, and timely in accordance with system specifications to meet the entity's objectives.",
  "P1.1": "The entity provides notice to data subjects about its privacy practices to meet the entity's objectives related to privacy. The notice is updated and communicated to data subjects in a timely manner for changes to the entity's privacy practices, including changes in the use of personal information, to meet the entity's objectives related to privacy.",
  "P2.1": "The entity communicates choices available regarding the collection, use, retention, disclosure, and disposal of personal information to the data subjects and the consequences, if any, of each choice. Explicit consent for the collection, use, retention, disclosure, and disposal of personal information is obtained from data subjects or other authorized persons, if required. Such consent is obtained only for the intended purpose of the information to meet the entity's objectives related to privacy. The entity's basis for determining implicit consent for the collection, use, retention, disclosure, and disposal of personal information is documented.",
  "P3.1": "Personal information is collected consistent with the entity's objectives related to privacy.",
  "P3.2": "For information requiring explicit consent, the entity communicates the need for such consent as well as the consequences of a failure to provide consent for the request for personal information and obtains the consent prior to the collection of the information to meet the entity's objectives related to privacy.",
  "P4.1": "The entity limits the use of personal information to the purposes identified in the entity's objectives related to privacy.",
  "P4.2": "The entity retains personal information consistent with the entity's objectives related to privacy.",
  "P4.3": "The entity securely disposes of personal information to meet the entity's objectives related to privacy.",
  "P5.1": "The entity grants identified and authenticated data subjects the ability to access their stored personal information for review and, upon request, provides physical or electronic copies of that information to data subjects to meet the entity's objectives related to privacy. If access is denied, data subjects are informed of the denial and reason for such denial, as required, to meet the entity's objectives related to privacy.",
  "P5.2": "The entity corrects, amends, or appends personal information based on information provided by data subjects and communicates such information to third parties, as committed or required, to meet the entity's objectives related to privacy. If a request for correction is denied, data subjects are informed of the denial and reason for such denial to meet the entity's objectives related to privacy.",
  "P6.1": "The entity discloses personal information to third parties with the explicit consent of data subjects and such consent is obtained prior to disclosure to meet the entity's objectives related to privacy.",
  "P6.2": "The entity creates and retains a complete, accurate, and timely record of authorized disclosures of personal information to meet the entity's objectives related to privacy.",
  "P6.3": "The entity creates and retains a complete, accurate, and timely record of detected or reported unauthorized disclosures (including breaches) of personal information to meet the entity's objectives related to privacy.",
  "P6.4": "The entity obtains privacy commitments from vendors and other third parties who have access to personal information to meet the entity's objectives related to privacy. The entity assesses those parties' compliance on a periodic and as-needed basis and takes corrective action, if necessary.",
  "P6.5": "The entity obtains commitments from vendors and other third parties with access to personal information to notify the entity in the event of actual or suspected unauthorized disclosures of personal information. Such notifications are reported to appropriate personnel and acted on in accordance with established incident-response procedures to meet the entity's objectives related to privacy.",
  "P6.6": "The entity provides notification of breaches and incidents to affected data subjects, regulators, and others to meet the entity's objectives related to privacy.",
  "P6.7": "The entity provides data subjects with an accounting of the personal information held and disclosure of the data subjects' personal information, upon the data subjects' request, to meet the entity's objectives related to privacy.",
  "P7.1": "The entity collects and maintains accurate, up-to-date, complete, and relevant personal information to meet the entity's objectives related to privacy.",
  "P8.1": "The entity implements a process for receiving, addressing, resolving, and communicating the resolution of inquiries, complaints, and disputes from data subjects and others and periodically monitors compliance to meet the entity's objectives related to privacy. Corrections and other necessary actions related to identified deficiencies are made or taken in a timely manner."
};

// Added to every system prompt. The server also replaces any em-dash that
// still appears in a response (see replaceEmDashes in api/_claude.js).
export const NO_EM_DASH_RULE = " Never use em-dashes (the long dash, Unicode U+2014) anywhere in your output text. Use commas, colons, periods, or parentheses instead.";

// ---- Assessment (Haiku) ----

export function buildAssessRequest({ framework, env, family, input }) {
  var familyHint = family !== "Any (Auto-detect)" ? " Focus on the " + family + " control family." : "";
  // Give the model the official text of every SOC 2 criterion so it picks
  // IDs by what each criterion covers instead of guessing from the number.
  var soc2CriteriaHint = framework.startsWith("SOC 2")
    ? " Official 2017 Trust Services Criteria text for every SOC 2 criterion. Choose controlMappings IDs only from this list, by matching what the input describes against what each criterion actually covers:\n" +
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
    system: "You are a precise GRC writer. For each control below, you are given its VERIFIED, AUTHORITATIVE definition from the real AICPA source (or, where none is available, a note saying so), plus the situation being assessed. Write a 1-2 sentence rationale for each control using ONLY what its definition actually covers. If the definition includes a 'Do NOT' instruction, you must not include that excluded concept anywhere in your rationale, even in passing or as a secondary point: treat it as a hard constraint, not a style preference. Also judge whether each control is a good fit. Judge by the substance of the definition, not its exact wording: an activity that clearly falls within the definition's scope counts even if the definition does not name it. Set relevant to false only if the situation does not describe anything the definition governs, if the control is merely associated with the topic, or if it would only apply because of a missing or undocumented process; otherwise set relevant to true. When relevant is false, the rationale must be one sentence explaining what the definition covers that the situation does not describe. Return ONLY valid JSON (no markdown, no backticks): an array of objects with keys {id, relevant, rationale}, where relevant is a boolean." + NO_EM_DASH_RULE + "\n\nControl definitions:\n" + defsText,
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
