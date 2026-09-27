// Dropdown values. The server has its own copy in api/_prompts.js and rejects
// anything not on its list; src/api.test.js checks the two stay identical.

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
