import { useState } from "react";

const FRAMEWORKS = [
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

const ENVS = [
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

const CONTROL_FAMILIES = [
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

const EXAMPLES = [
  {
    label: "IAM & Access Control (AWS)",
    text: "Our AWS environment uses IAM roles with least-privilege policies attached to all EC2 instances and Lambda functions. There are no IAM users with programmatic access keys in production. MFA is enforced on all human IAM users via a Service Control Policy at the AWS Organizations level."
  },
  {
    label: "Audit Logging (Azure)",
    text: "Azure Monitor and Defender for Cloud are enabled across all subscriptions. Diagnostic logs for all resources are forwarded to a centralized Log Analytics workspace with a 90-day retention policy. Alerts are configured for critical events including privilege escalation and policy changes."
  },
  {
    label: "Encryption at Rest (GCP)",
    text: "All data at rest in Google Cloud Storage and BigQuery is encrypted using Google-managed keys. Sensitive workloads use Customer-Managed Encryption Keys (CMEK) via Cloud KMS. Key rotation is configured annually and access to KMS keys is restricted to dedicated service accounts."
  },
  {
    label: "Incident Response",
    text: "The organization maintains a documented incident response plan reviewed annually. A SIEM aggregates logs from all cloud environments. On-call rotation is in place 24/7 with a defined escalation path. Tabletop exercises are conducted quarterly."
  }
];

const styles = `
  body { background: #1a1a1a; margin: 0; }
  .assess-btn { background: #c8a830; color: #1a1400; border: none; transition: background 0.2s; font-weight: 700; letter-spacing: 0.04em; }
  .assess-btn:hover:not(:disabled) { background: #d4b830; }
  .assess-btn:disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }
  .nist-tag { display: inline-block; font-size: 12px; font-family: monospace; padding: 4px 12px; border-radius: 99px; background: #1a2e2c; border: 1px solid #3d8a80; color: #6eccc0; text-decoration: none; transition: background 0.2s, color 0.2s, border-color 0.2s; cursor: pointer; }
  .nist-tag:hover { background: #2a4a46; color: #a0e8e0; border-color: #6eccc0; }
  textarea { background: #141414 !important; border: 1px solid #333 !important; color: #f5ead8 !important; }
  textarea:focus { outline: none; border-color: #c17f3a !important; }
  textarea::placeholder { color: #444 !important; }
  select { background: #141414 !important; border: 1px solid #333 !important; color: #f5ead8 !important; }
  .copy-btn { background: none; border: 1px solid #444; color: #888; font-size: 11px; padding: 3px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-family: inherit; }
  .copy-btn:hover { border-color: #6eccc0; color: #6eccc0; }
  .history-item { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 8px; padding: 0.6rem 0.9rem; cursor: pointer; transition: border-color 0.2s; }
  .history-item:hover { border-color: #c17f3a; }
  .example-btn { background: #1a1400; border: 1px solid #c8a830; color: #c8a830; font-size: 12px; padding: 5px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-family: inherit; text-align: left; }
  .example-btn:hover { border-color: #c17f3a; color: #c17f3a; }
  .help-step { display: flex; gap: 12px; padding: 0.6rem 0; border-bottom: 1px solid #2a2a2a; }
  .help-step:last-child { border-bottom: none; }
  .step-num { width: 22px; height: 22px; border-radius: 50%; background: #c17f3a; color: #1a1400; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  @keyframes spin { 0%{opacity:1} 33%{opacity:0.3} 66%{opacity:0.3} 100%{opacity:1} }
  .dot1{animation:spin 1.2s infinite} .dot2{animation:spin 1.2s 0.4s infinite} .dot3{animation:spin 1.2s 0.8s infinite}
 @media print { .no-print { display: none !important; } body { background: white !important; color: black !important; } .poam-row { border-color: #ccc !important; } }
  .poam-row input, .poam-row select { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;
const SOC2_TSC_REFERENCE = "Reference for SOC 2 Trust Services Criteria — use ONLY these real control numbers and topics, and do not substitute another framework's domain names: CC1.x = Control Environment, CC2.x = Communication & Information, CC3.x = Risk Assessment, CC4.x = Monitoring Activities, CC5.x = Control Activities, CC6.x = Logical & Physical Access Controls, CC7.x = System Operations (7.1 Detection of security events/vulnerabilities, 7.2 Monitoring for anomalies via defined procedures, 7.3 Evaluation of identified security incidents, 7.4 Response, containment, and communication/notification to affected parties, 7.5 Recovery from identified incidents), CC8.x = Change Management, CC9.1 = Risk mitigation for business disruptions, CC9.2 = Risk mitigation for vendor and business partner relationships, A1.x = Availability (A1.1 Capacity Planning & Forecasting, A1.2 Environmental Protections/Backup/Recovery Infrastructure, A1.3 Recovery Plan Testing), C1.x = Confidentiality, PI1.x = Processing Integrity, P1.x-P8.x = Privacy. Do NOT use ISO 27001 Annex A domain names (e.g., 'Organization of Information Security', 'Information Security Policies and Procedures') to describe SOC 2 controls — these are a different framework.";

const SOC2_TYPE_I_GUIDANCE = " This is a SOC 2 Type I examination: it evaluates whether controls are suitably designed and implemented as of a specific date, not whether they operated effectively over time. Focus assessment questions on control design and implementation. Evidence should be point-in-time (policies, procedures, system configurations, screenshots, and a single walkthrough of the control), not samples drawn across an observation period. Do not recommend operating-effectiveness testing over a period.";

const SOC2_TYPE_II_GUIDANCE = " This is a SOC 2 Type II examination: it evaluates whether controls operated effectively throughout an observation period (typically 3-12 months). Include assessment questions about consistency of operation across the period. Evidence should include full populations and samples drawn across the observation period, not just a single point-in-time example.";

const FRAMEWORK_REFERENCES = {
  "SOC 2 Type I": SOC2_TSC_REFERENCE + SOC2_TYPE_I_GUIDANCE,
  "SOC 2 Type II": SOC2_TSC_REFERENCE + SOC2_TYPE_II_GUIDANCE,
};

// Verified against AICPA Trust Services Criteria — fill in more entries over time.
// Only entries listed here override the AI's generated name; anything missing falls back to Claude's own text.
const SOC2_CONTROLS = {
  // Verified against the actual AICPA 2017 TSC document (TSP Section 100)
  "CC1.1": "Control Environment: Commitment to Integrity & Ethical Values",
  "CC1.2": "Control Environment: Board Independence & Oversight",
  "CC1.3": "Control Environment: Structures, Reporting Lines & Authorities",
  "CC1.4": "Control Environment: Commitment to Competence",
  "CC1.5": "Control Environment: Accountability for Internal Control",
  "CC2.1": "Communication & Information: Quality Information to Support Internal Control",
  "CC2.2": "Communication & Information: Internal Communication of Objectives & Responsibilities",
  "CC2.3": "Communication & Information: External Communication",
  "CC3.1": "Risk Assessment: Specifies Objectives With Sufficient Clarity",
  "CC3.2": "Risk Assessment: Identifies & Analyzes Risk",
  "CC3.3": "Risk Assessment: Considers Potential for Fraud",
  "CC3.4": "Risk Assessment: Identifies & Assesses Significant Change",
  "CC4.1": "Monitoring Activities: Ongoing & Separate Evaluations",
  "CC4.2": "Monitoring Activities: Communicates Control Deficiencies",
  "CC5.1": "Control Activities: Selects & Develops Activities (incl. Segregation of Duties)",
  "CC5.2": "Control Activities: General Controls Over Technology",
  "CC5.3": "Control Activities: Deploys Policies & Procedures",
  "CC6.1": "Logical & Physical Access: Logical Access Security Software & Architecture",
  "CC6.2": "Logical & Physical Access: Prior to Issuing System Credentials",
  "CC6.3": "Logical & Physical Access: Authorizes/Removes Access by Role (Least Privilege)",
  "CC6.4": "Logical & Physical Access: Restricts Physical Access to Facilities",
  "CC6.5": "Logical & Physical Access: Discontinues Protections After Data Disposal",
  "CC6.6": "Logical & Physical Access: Protects Against External Threats",
  "CC6.7": "Logical & Physical Access: Restricts Transmission & Movement of Information",
  "CC6.8": "Logical & Physical Access: Prevents/Detects Unauthorized or Malicious Software",
  "CC7.1": "System Operations: Vulnerability & Configuration Change Detection",
  "CC7.2": "System Operations: Monitoring for Anomalies",
  "CC7.3": "System Operations: Evaluation of Security Incidents",
  "CC7.4": "System Operations: Incident Response, Containment & Notification",
  "CC7.5": "System Operations: Recovery From Incidents",
  "CC8.1": "Change Management",
  "CC9.1": "Risk Mitigation: Business Disruption",
  "CC9.2": "Risk Mitigation: Vendor & Business Partner Risk",
  "A1.1": "Availability: Capacity Planning & Forecasting",
  "A1.2": "Availability: Environmental Protections, Backup & Recovery Infrastructure",
  "A1.3": "Availability: Recovery Plan Testing",
  "C1.1": "Confidentiality: Identifies & Maintains Confidential Information",
  "C1.2": "Confidentiality: Disposal of Confidential Information",

  // Provisional — not yet checked against the primary AICPA source; verify before fully trusting
  "PI1.1": "Processing Integrity: Defines Processing Objectives",
  "PI1.2": "Processing Integrity: Inputs Complete, Accurate & Valid",
  "PI1.3": "Processing Integrity: Processing Complete, Accurate & Authorized",
  "PI1.4": "Processing Integrity: Outputs Complete, Accurate & Timely",
  "PI1.5": "Processing Integrity: Stored Data Remains Complete & Accurate",
  "P1.1": "Privacy: Notice to Data Subjects",
  "P2.1": "Privacy: Choice & Consent",
  "P3.1": "Privacy: Collection of Personal Information",
  "P4.1": "Privacy: Use, Retention & Disposal",
  "P5.1": "Privacy: Access by Data Subjects",
  "P6.1": "Privacy: Disclosure & Notification to Third Parties",
  "P7.1": "Privacy: Quality of Personal Information",
  "P8.1": "Privacy: Monitoring & Enforcement",
};
const SOC2_GROUNDED_DEFINITIONS = {
  "CC1.1": "The entity demonstrates a commitment to integrity and ethical values.",
  "CC1.2": "The board of directors demonstrates independence from management and exercises oversight of the development and performance of internal control. This is specifically about board composition, independence, and oversight activity — not general management accountability or policy communication (that's CC1.1/CC1.3/CC2.2).",
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
  "CC6.1": "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives. Do NOT map CC6.1 for internal endpoint management, internal patch management, internal software updates, or general vulnerability scanning.",
  "CC6.2": "Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity. For those users whose access is administered by the entity, user system credentials are removed when user access is no longer authorized.",
  "CC6.3": "The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, or the system design and changes, giving consideration to the concepts of least privilege and segregation of duties, to meet the entity's objectives.",
  "CC6.4": "The entity restricts physical access to facilities and protected information assets (for example, data center facilities, backup media storage, and other sensitive locations) to authorized personnel to meet the entity's objectives.",
  "CC6.5": "The entity discontinues logical and physical protections over physical assets only after the ability to read or recover data and software from those assets has been diminished and is no longer required to meet the entity's objectives.",
  "CC6.6": "The entity implements logical access security measures to protect against threats from sources outside its system boundaries.",
  "CC6.7": "The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes, and protects it during transmission, movement, or removal to meet the entity's objectives.",
  "CC6.8": "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software to meet the entity's objectives. Do NOT map CC6.8 for generic system patches or OS updates unless explicit anti-malware measures (like AV or EDR) are mentioned.",
  "CC7.1": "To meet its objectives, the entity uses detection and monitoring procedures to identify (1) changes to configurations that result in the introduction of new vulnerabilities, and (2) susceptibilities to newly discovered vulnerabilities. This is specifically vulnerability and configuration-change detection — not general security incident detection (that's CC7.2/CC7.3).",
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
  "C1.2": "The entity disposes of confidential information to meet the entity\u2019s objectives related to confidentiality. This is specifically about the disposal/destruction of confidential information — the physical or logical process of removing it so it can no longer be accessed. Do NOT frame this control around who is authorized to access confidential information, access permissions, or authorization requirements — that is a different control (access control / authorization), not C1.2. C1.2 is strictly about the act of destroying/disposing of data once it's no longer needed.",
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
export default function App() {
  const [input, setInput] = useState("");
  const [env, setEnv] = useState("AWS");
  const [framework, setFramework] = useState("NIST SP 800-53 Rev 5");
  const [family, setFamily] = useState("Any (Auto-detect)");
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [result, setResult] = useState(null);
  const [plainResult, setPlainResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("rw-history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [poam, setPoam] = useState(() => {
  try {
    const saved = localStorage.getItem("rw-poam");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
});

function updatePoam(weaknessId, field, value) {
  setPoam(prev => {
    const updated = { ...prev, [weaknessId]: { ...prev[weaknessId], [field]: value } };
    try { localStorage.setItem("rw-poam", JSON.stringify(updated)); } catch {}
    return updated;
  });
}
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState("");
  const [viewMode, setViewMode] = useState("tech");

  async function assess() {
    setError("");
    setResult(null);
    setPlainResult(null);
    setViewMode("tech");
    setLoading(true);
    const suspiciousPatterns = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /system prompt/i,
  /api.?key/i,
  /reveal|expose|leak|dump/i,
  /jailbreak/i,
  /pretend you are/i,
  /you are now/i,
];
if (suspiciousPatterns.some(function(p) { return p.test(input); })) {
  setError("Input contains unsupported content. Please describe a security control or system configuration.");
  setLoading(false);
  return;
}
    try {
      var familyHint = family !== "Any (Auto-detect)" ? " Focus on the " + family + " control family." : "";
      // Give the model the official text of every SOC 2 criterion so it picks
      // IDs by what each criterion covers instead of guessing from the number.
      var soc2CriteriaHint = framework.startsWith("SOC 2")
        ? " Official 2017 Trust Services Criteria text for every SOC 2 criterion. Choose controlMappings IDs only from this list, by matching what the input describes against what each criterion actually covers:\n" +
          Object.keys(SOC2_GROUNDED_DEFINITIONS).map(function(id) { return id + ": " + SOC2_GROUNDED_DEFINITIONS[id]; }).join("\n") + "\n"
        : "";
      var res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 6000,
          system: "You are a senior GRC analyst and security control assessor specializing in " + env + " cloud environments and " + framework + " compliance." + familyHint + (FRAMEWORK_REFERENCES[framework] ? " " + FRAMEWORK_REFERENCES[framework] : "") + soc2CriteriaHint + " Return ONLY valid JSON (no markdown, no backticks) with these exact keys: assessmentQuestions (array of 6-8 specific interview questions an auditor would ask), evidenceToCollect (array of 6-8 specific artifacts/screenshots/logs to request), potentialWeaknesses (array of 4-6 objects with {name, description, severity, recommendation} where severity is High/Medium/Low), controlMappings (array of 3-6 objects with {id, name, rationale}, using control identifiers native to the selected framework — e.g., CC-series like CC6.1 for SOC 2, Annex A numbering like A.9.4.2 for ISO 27001, requirement numbers like 8.3 for PCI DSS, AC-2 style IDs only for NIST-based frameworks — never default to NIST numbering for a non-NIST framework. STRICT INCLUSION RULE: only include a control if the input text directly and specifically describes an activity, system, or process that control governs. Do NOT include a control because it is commonly associated with the topic, because a related control might also be relevant, or because the organization 'should' or 'must' also have that control in place — if the input doesn't describe it, leave it out. Do NOT include a control based on an inferred gap or missing control ('no evidence of X' is a reason to exclude, not include). Every rationale must cite the specific words or facts from the input that justify that control's inclusion — if you cannot point to something explicitly stated in the input, do not include the control.), overallRiskScore (a number 1-10 where 10 is highest risk), riskJustification (2-3 sentence explanation of the score), controlMaturity (one of: Initial/Developing/Defined/Managed/Optimizing), maturityJustification (1-2 sentence explanation). Be specific to " + env + " services and " + framework + " requirements.",
          messages: [{ role: "user", content: "Assess this security control:\n\n" + input }]
        })
      });
      var data = await res.json();
      if (data.error) throw new Error(data.error.message);
      var text = data.content.find(function(b) { return b.type === "text"; })?.text || "";
      var parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

      // Check mapped controls: rewrite the rationale for those with verified
      // definitions so it stays within what the real AICPA criterion covers,
      // and flag (never remove) any the input doesn't clearly describe. For
      // SOC 2, controls without a verified definition are judged too, from
      // the model's own knowledge, and their flags say so.
      var flagged = (parsed.controlMappings || []).filter(function(c) {
        return SOC2_GROUNDED_DEFINITIONS[c.id] || framework.startsWith("SOC 2");
      });
      if (flagged.length > 0) {
        var defsText = flagged.map(function(c) {
          return SOC2_GROUNDED_DEFINITIONS[c.id]
            ? c.id + ": " + SOC2_GROUNDED_DEFINITIONS[c.id]
            : c.id + ": (no verified definition — judge fit from your knowledge of the 2017 Trust Services Criteria)";
        }).join("\n");
        try {
          var groundRes = await fetch("/api/assess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // The fit judgment needs a stronger model than the main call;
              // Haiku repeatedly misjudged which criteria cover MFA.
              model: "claude-opus-5",
              max_tokens: 4000,
              output_config: { effort: "medium" },
              system: "You are a precise GRC writer. For each control below, you are given its VERIFIED, AUTHORITATIVE definition from the real AICPA source (or, where none is available, a note saying so), plus the situation being assessed. Write a 1-2 sentence rationale for each control using ONLY what its definition actually covers. If the definition includes a 'Do NOT' instruction, you must not include that excluded concept anywhere in your rationale, even in passing or as a secondary point — treat it as a hard constraint, not a style preference. Also judge whether each control is a good fit. Judge by the substance of the definition, not its exact wording: an activity that clearly falls within the definition's scope counts even if the definition does not name it. Set relevant to false only if the situation does not describe anything the definition governs, if the control is merely associated with the topic, or if it would only apply because of a missing or undocumented process; otherwise set relevant to true. When relevant is false, the rationale must be one sentence explaining what the definition covers that the situation does not describe. Return ONLY valid JSON (no markdown, no backticks): an array of objects with keys {id, relevant, rationale}, where relevant is a boolean.\n\nControl definitions:\n" + defsText,
              messages: [{ role: "user", content: "Situation being assessed:\n\n" + input }]
            })
          });
          var groundData = await groundRes.json();
          if (!groundData.error) {
            var groundText = groundData.content.find(function(b) { return b.type === "text"; })?.text || "";
            var grounded = JSON.parse(groundText.replace(/```json|```/g, "").trim());
            var groundedMap = {};
            var weakFitMap = {};
            grounded.forEach(function(g) {
              if (g.relevant === false) weakFitMap[g.id] = g.rationale;
              else groundedMap[g.id] = g.rationale;
            });
            parsed.controlMappings = parsed.controlMappings.map(function(c) {
              var verified = !!SOC2_GROUNDED_DEFINITIONS[c.id];
              if (weakFitMap[c.id]) return { ...c, weakFit: weakFitMap[c.id], weakFitUnverified: !verified };
              // Only verified definitions may replace the original rationale.
              return verified && groundedMap[c.id] ? { ...c, rationale: groundedMap[c.id] } : c;
            });
          }
        } catch (e) {
          // grounding call failed — keep the original rationale rather than breaking the assessment
        }
      }

parsed.potentialWeaknesses = parsed.potentialWeaknesses.map(function(w, i) {
  return { ...w, id: framework + "-" + env + "-" + i + "-" + Date.now() };
});
      setResult(parsed);
      setHistory(function(prev) {
        const updated = [{ input: input.substring(0, 80) + "...", env: env, framework: framework, result: parsed, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)];
        try { localStorage.setItem("rw-history", JSON.stringify(updated)); } catch {}
        return updated;
      });
    } catch (e) {
      if (e.message?.includes("401") || e.message?.includes("invalid x-api-key") || e.message?.includes("authentication")) {
        setError("Invalid API key. Check your ANTHROPIC_API_KEY in Vercel environment variables.");
      } else if (e.message?.includes("429") || e.message?.includes("rate")) {
        setError("Rate limit hit. Wait 30 seconds and try again.");
      } else if (e.message?.includes("fetch") || e.message?.includes("network") || e.message?.includes("Failed")) {
        setError("Network error. Check your internet connection and try again.");
      } else if (e.message?.includes("JSON")) {
        setError("Unexpected response from Claude. Try again or simplify your input.");
      } else {
        setError(e.message || "Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  }

  async function switchToPlain() {
    if (plainResult) { setViewMode("plain"); return; }
    setTranslating(true);
    try {
      var res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 6000,
          system: "You are a communication specialist who translates technical GRC security findings into plain business language. Return ONLY valid JSON (no markdown, no backticks) with these exact keys: assessmentQuestionsPlain (array of the same number of questions rewritten in plain language for a non-technical business audience, no jargon or control IDs), evidenceToCollectPlain (array of the same evidence items rewritten in plain language a business stakeholder would understand), potentialWeaknessesPlain (array of the same weaknesses as objects with {name, description, severity, recommendation} rewritten in plain business language explaining business risk and impact, no technical jargon), riskJustificationPlain (risk explanation rewritten for a business executive with no GRC background), maturityJustificationPlain (maturity explanation in plain business language).",
          messages: [{ role: "user", content: "Translate these GRC findings into plain business language:\n\n" + JSON.stringify(result) }]
        })
      });
      var data = await res.json();
      if (data.error) throw new Error(data.error.message);
      var text = data.content.find(function(b) { return b.type === "text"; })?.text || "";
      var parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setPlainResult(parsed);
      setViewMode("plain");
    } catch (e) {
      setError("Could not load Plain Talk. Try again.");
    }
    setTranslating(false);
  }

  function switchToTech() {
    setViewMode("tech");
  }

  function copySection(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(function() { setCopied(""); }, 2000);
  }

  function loadExample(ex) {
    setInput(ex.text);
  }

  var riskColor = "#6eccc0";
  var maturityColors = { "Initial": "#6eccc0", "Developing": "#6eccc0", "Defined": "#6eccc0", "Managed": "#6eccc0", "Optimizing": "#6eccc0" };

  var questions = viewMode === "plain" && plainResult ? plainResult.assessmentQuestionsPlain : result?.assessmentQuestions;
  var evidence = viewMode === "plain" && plainResult ? plainResult.evidenceToCollectPlain : result?.evidenceToCollect;
  var weaknesses = viewMode === "plain" && plainResult ? plainResult.potentialWeaknessesPlain : result?.potentialWeaknesses;
  var riskJust = viewMode === "plain" && plainResult ? plainResult.riskJustificationPlain : result?.riskJustification;
  var maturityJust = viewMode === "plain" && plainResult ? plainResult.maturityJustificationPlain : result?.maturityJustification;

  return (
    <>
      <style>{styles}</style>
      <div style={{ minHeight: "100vh", background: "#1a1a1a", color: "#f5ead8", fontFamily: "system-ui, sans-serif", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }} className="no-print">
            <span style={{ fontSize: 11, background: "#1a2e2c", color: "#6eccc0", padding: "4px 14px", borderRadius: 99, fontWeight: 700, letterSpacing: "0.08em", border: "1px solid #3d8a80" }}>
              GRC PORTFOLIO TOOL
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() { setShowHelp(!showHelp); setShowHistory(false); }} style={{ background: "none", border: "1px solid #444", color: "#888", fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                {showHelp ? "Hide help" : "How to use"}
              </button>
              {result && (
                <>
                  <button onClick={function() { window.print(); }} style={{ background: "none", border: "1px solid #444", color: "#888", fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                    Export PDF
                  </button>
                  <button onClick={assess} disabled={loading} style={{ background: "none", border: "1px solid #444", color: "#888", fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                    Regenerate
                  </button>
                </>
              )}
              {history.length > 0 && (
                <button onClick={function() { setShowHistory(!showHistory); setShowHelp(false); }} style={{ background: "none", border: "1px solid #444", color: "#888", fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                  History ({history.length})
                </button>
              )}
            </div>
          </div>

          <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0", paddingBottom: "2px", color: "#f5ead8" }}>Risk Whisperer</h1>
          <p style={{ color: "#aaa", margin: "2px 0 1rem", fontSize: 16 }}>Know your risks before your auditor does.</p>
          <p style={{ color: "#555", marginBottom: "1.5rem", fontSize: 12 }}>AI-powered · Continuous compliance from assessment to remediation · {framework} · {env}</p>

          {showHelp && (
            <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }} className="no-print">
              <p style={{ fontSize: 12, fontWeight: 700, color: "#c17f3a", margin: "0 0 0.75rem", letterSpacing: "0.08em" }}>HOW TO USE Risk Whisperer</p>
              <div style={{ marginBottom: "1rem" }}>
                <div className="help-step">
                  <div className="step-num">1</div>
                  <div>
                    <p style={{ fontSize: 13, color: "#f5ead8", margin: "0 0 2px", fontWeight: 600 }}>Describe your security control</p>
                    <p style={{ fontSize: 12, color: "#777", margin: 0, lineHeight: 1.6 }}>Paste in a policy, system configuration, or control description. The more detail you provide, the more specific the assessment. Use the example buttons below the text box to get started.</p>
                  </div>
                </div>
                <div className="help-step">
                  <div className="step-num">2</div>
                  <div>
                    <p style={{ fontSize: 13, color: "#f5ead8", margin: "0 0 2px", fontWeight: 600 }}>Select your environment and framework</p>
                    <p style={{ fontSize: 12, color: "#777", margin: 0, lineHeight: 1.6 }}>Choose the cloud platform the control applies to and the compliance framework you are assessing against. Optionally narrow by control family.</p>
                  </div>
                </div>
                <div className="help-step">
                  <div className="step-num">3</div>
                  <div>
                    <p style={{ fontSize: 13, color: "#f5ead8", margin: "0 0 2px", fontWeight: 600 }}>Click Assess control</p>
                    <p style={{ fontSize: 12, color: "#777", margin: 0, lineHeight: 1.6 }}>Risk Whisperer will analyze your control and return results in about 10-15 seconds.</p>
                  </div>
                </div>
               <div className="help-step">
                  <div className="step-num">4</div>
                  <div>
                    <p style={{ fontSize: 13, color: "#f5ead8", margin: "0 0 2px", fontWeight: 600 }}>Review and export your results</p>
                    <p style={{ fontSize: 12, color: "#777", margin: 0, lineHeight: 1.6 }}>Use the Copy buttons to grab individual sections, or Export PDF to save the full report. Past assessments are saved in History.</p>
                  </div>
                </div>
                <div className="help-step">
                  <div className="step-num">5</div>
                  <div>
                    <p style={{ fontSize: 13, color: "#f5ead8", margin: "0 0 2px", fontWeight: 600 }}>Track remediation with POA&M</p>
                    <p style={{ fontSize: 12, color: "#777", margin: 0, lineHeight: 1.6 }}>Under each identified weakness, assign an owner, set a target remediation date, and track status (Open, In Progress, Closed, Deferred). Your entries save automatically and persist across sessions.</p>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 0.5rem", letterSpacing: "0.06em" }}>UNDERSTANDING YOUR RESULTS</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["Risk Score", "1-3 = Low risk, 4-6 = Medium, 7-10 = High. Based on gaps identified in the control description."],
                  ["Control Maturity", "Rates how mature and repeatable the control is, from Initial (ad-hoc) to Optimizing (continuously improving)."],
                  ["Assessment Questions", "Interview questions to ask the control owner during a formal audit or assessment."],
                  ["Evidence to Collect", "Specific screenshots, logs, and documents to request as audit evidence."],
                  ["Weaknesses", "Security gaps identified in the control, rated High/Medium/Low with remediation steps."],
                  ["Control Mappings", "Official framework controls that apply to the selected compliance framework."]
                ].map(function(item, i) {
                  return (
                    <div key={i} style={{ background: "#1e1e1e", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#c17f3a", margin: "0 0 2px" }}>{item[0]}</p>
                      <p style={{ fontSize: 11, color: "#777", margin: 0, lineHeight: 1.5 }}>{item[1]}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showHistory && (
            <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }} className="no-print">
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 0.75rem", fontWeight: 700, letterSpacing: "0.06em" }}>RECENT ASSESSMENTS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map(function(item, i) {
                  return (
                    <div key={i} className="history-item" onClick={function() { setInput(item.input.replace("...", "")); setEnv(item.env); setFramework(item.framework); setResult(item.result); setPlainResult(null); setViewMode("tech"); setShowHistory(false); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#d8c8a8" }}>{item.input}</span>
                        <span style={{ fontSize: 11, color: "#555" }}>{item.timestamp}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#6eccc0" }}>{item.env} · {item.framework}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }} className="no-print">
            <label style={{ fontSize: 11, fontWeight: 700, color: "#c17f3a", display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>
              CONTROL DESCRIPTION OR SYSTEM DETAIL
            </label>
            <textarea
              value={input}
              onChange={function(e) { setInput(e.target.value); }}
              placeholder="Describe the security control, policy, or system configuration you want assessed. Include technologies used, processes in place, and any relevant context. The more specific you are, the better the assessment..."
              style={{ width: "100%", minHeight: 130, padding: "0.75rem", borderRadius: 8, fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: 11, color: input.trim().length < 50 ? "#555" : "#3d8a80", margin: "4px 0 0", textAlign: "right" }}>
              {input.trim().length}/2000 {input.trim().length < 50 && input.trim().length > 0 ? `· ${50 - input.trim().length} more characters needed` : input.trim().length >= 50 ? "✓ Ready" : ""}
            </p>
 
            <div style={{ marginTop: 8, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#c8a830", margin: "0 0 6px", letterSpacing: "0.06em", fontWeight: 700 }}>LOAD AN EXAMPLE</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXAMPLES.map(function(ex, i) {
                  return (
                    <button key={i} className="example-btn" onClick={function() { loadExample(ex); }}>
                      {ex.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#c17f3a", display: "block", marginBottom: 4, fontWeight: 700, letterSpacing: "0.08em" }}>CLOUD ENVIRONMENT</label>
                <select value={env} onChange={function(e) { setEnv(e.target.value); }}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: 13 }}>
                  {ENVS.map(function(e) { return <option key={e}>{e}</option>; })}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#c17f3a", display: "block", marginBottom: 4, fontWeight: 700, letterSpacing: "0.08em" }}>COMPLIANCE FRAMEWORK</label>
                <select value={framework} onChange={function(e) { setFramework(e.target.value); }}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: 13 }}>
                  {FRAMEWORKS.map(function(f) { return <option key={f}>{f}</option>; })}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#c17f3a", display: "block", marginBottom: 4, fontWeight: 700, letterSpacing: "0.08em" }}>CONTROL FAMILY</label>
                <select value={family} onChange={function(e) { setFamily(e.target.value); }}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: 13 }}>
                  {CONTROL_FAMILIES.map(function(f) { return <option key={f}>{f}</option>; })}
                </select>
              </div>
            </div>
            <button onClick={assess} disabled={loading || input.trim().length < 50 || input.trim().length > 2000} className="assess-btn"
              style={{ width: "100%", marginTop: 12, padding: "0.75rem", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
              {loading ? (
  <LoadingMessage />
) : "Assess control"}
            </button>
          </div>

          {error && (
            <div style={{ background: "#2a1a1a", border: "1px solid #5a2a2a", borderRadius: 8, padding: "0.75rem 1rem", color: "#c07070", fontSize: 13, marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          {result && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }} className="no-print">
                <button
                  onClick={switchToTech}
                  style={{ padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", border: viewMode === "tech" ? "1px solid #6eccc0" : "1px solid #444", background: viewMode === "tech" ? "#1a2e2c" : "none", color: viewMode === "tech" ? "#6eccc0" : "#666", fontFamily: "inherit" }}>
                   💻 Tech Talk
                </button>
                <button
                  onClick={switchToPlain}
                  disabled={translating}
                  style={{ padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: translating ? "default" : "pointer", border: viewMode === "plain" ? "1px solid #c8a830" : "1px solid #444", background: viewMode === "plain" ? "#1a1400" : "none", color: viewMode === "plain" ? "#c8a830" : "#666", fontFamily: "inherit" }}>
                  {translating ? "Translating..." : "💬 Plain Talk"}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, padding: "1.25rem" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>OVERALL RISK SCORE</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 48, fontWeight: 700, color: riskColor, lineHeight: 1 }}>{result.overallRiskScore}</span>
                      <span style={{ fontSize: 16, color: "#444" }}>/10</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#777", margin: "0.5rem 0 0", lineHeight: 1.6 }}>{riskJust}</p>
                  </div>
                  <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, padding: "1.25rem" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>CONTROL MATURITY</p>
                    <span style={{ fontSize: 28, fontWeight: 700, color: maturityColors[result.controlMaturity] || "#6eccc0" }}>{result.controlMaturity}</span>
                    <p style={{ fontSize: 12, color: "#777", margin: "0.5rem 0 0", lineHeight: 1.6 }}>{maturityJust}</p>
                  </div>
                </div>

                <Card title="Assessment questions" accent="#d4902a" onCopy={function() { copySection((questions || []).join("\n"), "questions"); }} copied={copied === "questions"}>
                  <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
                    {(questions || []).map(function(q, i) {
                      return <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#d8c8a8" }}>{q}</li>;
                    })}
                  </ul>
                </Card>

                <Card title="Evidence to collect" accent="#6eccc0" onCopy={function() { copySection((evidence || []).join("\n"), "evidence"); }} copied={copied === "evidence"}>
                  <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
                    {(evidence || []).map(function(e, i) {
                      return <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#d8c8a8" }}>{e}</li>;
                    })}
                  </ul>
                </Card>

 <Card title="Potential weaknesses & recommendations" accent="#e07030" onCopy={function() { copySection((weaknesses || []).map(function(w) { return w.name + " (" + w.severity + "): " + w.description + " Recommendation: " + w.recommendation; }).join("\n\n"), "weaknesses"); }} copied={copied === "weaknesses"}>
  {(weaknesses || []).map(function(w, i) {
    var sevBg = w.severity === "High" ? "#3a1a0a" : w.severity === "Medium" ? "#2a2a0a" : "#0a2a2a";
    var sevColor = w.severity === "High" ? "#e07030" : w.severity === "Medium" ? "#c8a830" : "#50b8b0";
    var sevBorder = w.severity === "High" ? "#7a3a10" : w.severity === "Medium" ? "#6a5a10" : "#1a6a60";
    var wId = w.id || i;
    var entry = poam[wId] || {};
    return (
      <div key={i} style={{ padding: "0.75rem 0", borderBottom: i < (weaknesses || []).length - 1 ? "1px solid #2a2a2a" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f5ead8" }}>{w.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99, background: sevBg, color: sevColor, border: "1px solid " + sevBorder, marginLeft: "auto" }}>{w.severity}</span>
        </div>
        <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, margin: "0 0 6px" }}>{w.description}</p>
        <p style={{ fontSize: 12, color: "#6eccc0", lineHeight: 1.6, margin: "0 0 12px" }}><strong style={{ color: "#6eccc0" }}>Recommendation: </strong>{w.recommendation}</p>

        {/* POA&M Fields */}
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }} className="poam-row">
          <div>
            <label style={{ fontSize: 10, color: "#c17f3a", fontWeight: 700, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>STATUS</label>
            <select
              value={entry.status || "Open"}
              onChange={function(e) { updatePoam(wId, "status", e.target.value); }}
              style={{ width: "100%", background: "#141414", border: "1px solid #333", color: "#f5ead8", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit" }}>
              <option>Open</option>
              <option>In Progress</option>
              <option>Closed</option>
              <option>Deferred</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#c17f3a", fontWeight: 700, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>OWNER</label>
            <input
              type="text"
              placeholder="Assign owner..."
              value={entry.owner || ""}
              onChange={function(e) { updatePoam(wId, "owner", e.target.value); }}
              style={{ width: "100%", background: "#141414", border: "1px solid #333", color: "#f5ead8", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#c17f3a", fontWeight: 700, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>TARGET DATE</label>
            <input
              type="date"
              value={entry.dueDate || ""}
              onChange={function(e) { updatePoam(wId, "dueDate", e.target.value); }}
              style={{ width: "100%", background: "#141414", border: "1px solid #333", color: "#f5ead8", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
        </div>
      </div>
    );
  })}
</Card>

               <Card title={framework + " control mappings"} accent="#c8a830" onCopy={function() { copySection(result.controlMappings.map(function(c) { return c.id + " - " + (SOC2_CONTROLS[c.id] || c.name) + ": " + c.rationale + (c.weakFit ? " (Weak fit: " + c.weakFit + (c.weakFitUnverified ? " — judged without a verified definition" : "") + ")" : ""); }).join("\n\n"), "controls"); }} copied={copied === "controls"}>
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
    {result.controlMappings.map(function(c, i) {
      return framework.indexOf("NIST") === 0 ? (
        <a key={i} className="nist-tag" href={"https://csrc.nist.gov/projects/cprt/catalog#/cprt/framework/version/SP_800_53_5_1_0/home?element=" + c.id} target="_blank" rel="noreferrer">{c.id}</a>
      ) : (
        <span key={i} className="nist-tag">{c.id}</span>
      );
    })}
  </div>
  <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
  {result.controlMappings.map(function(c, i) {
              const displayName = SOC2_CONTROLS[c.id] || c.name;
              return (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#d8c8a8" }}>
                  <strong style={{ color: "#f5ead8" }}>{c.id} - {displayName}:</strong> {c.rationale}
{c.weakFit && (
  <span style={{ display: "block", fontSize: 11, color: "#e0a040", marginTop: 4 }}>
    ⚠ Weak fit: {c.weakFit}{c.weakFitUnverified && " (judged without a verified definition)"}
  </span>
)}
{!SOC2_CONTROLS[c.id] && framework.startsWith("SOC 2") && (
  <span style={{ display: "block", fontSize: 10, color: "#a89060", marginTop: 4, fontStyle: "italic" }}>
    Control name AI-generated, not yet verified against source
  </span>
)}
{SOC2_CONTROLS[c.id] && framework.startsWith("SOC 2") && (
  <span style={{ display: "block", fontSize: 10, color: "#a89060", marginTop: 4, fontStyle: "italic" }}>
    Control name verified · explanation AI-generated
  </span>
)}
                </li>
              );
            })}
                  </ul>
                </Card>
              </div>
            </>
          )}

          <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #2a2a2a", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#444", margin: 0, lineHeight: 1.6 }}>
              Risk Whisperer is a portfolio and educational tool. Outputs should be reviewed by a qualified GRC professional before use in formal audits or compliance programs.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
function LoadingMessage() {
  const messages = [
    "Reviewing control description...",
    "Analyzing compliance gaps...",
    "Identifying potential weaknesses...",
    "Mapping framework controls...",
    "Generating assessment questions...",
    "Calculating risk score...",
    "Preparing evidence checklist...",
    "Finalizing recommendations..."
  ];
  const [index, setIndex] = useState(0);
  useState(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % messages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <span className="dot1" style={{ fontSize: 18, lineHeight: 1 }}>⏳</span>
      {messages[index]}
    </span>
  );
}
function Card({ title, accent, children, onCopy, copied }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.25rem", borderLeft: "3px solid " + accent, cursor: "pointer", borderBottom: open ? "1px solid #333" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.06em" }}>{title.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {open && <button className="copy-btn no-print" onClick={e => { e.stopPropagation(); onCopy(); }}>{copied ? "Copied!" : "Copy"}</button>}
          <span style={{ color: "#555", fontSize: 16, lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && <div style={{ padding: "1rem 1.25rem" }}>{children}</div>}
    </div>
  );
}
