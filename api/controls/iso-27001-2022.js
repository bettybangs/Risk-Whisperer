// Control ID list for ISO/IEC 27001:2022 Annex A (93 controls).
//
// Holds IDs, my own short titles, and the category only. No text from the
// standard is reproduced. The titles are paraphrases for display and review,
// not the official control names.
//
// listStatus is "draft" until the owner has checked every ID against their
// copy of the standard and changed it to "verified". The UI must not call a
// draft list "Verified".
//
// Not covered: the ISMS clauses (4 to 10), which are not Annex A controls.

const ORGANIZATIONAL = [
  ["A.5.1", "Information security policies"],
  ["A.5.2", "Security roles and responsibilities"],
  ["A.5.3", "Segregation of duties"],
  ["A.5.4", "Management responsibilities"],
  ["A.5.5", "Contact with authorities"],
  ["A.5.6", "Contact with special interest groups"],
  ["A.5.7", "Threat intelligence"],
  ["A.5.8", "Security in project management"],
  ["A.5.9", "Inventory of information and assets"],
  ["A.5.10", "Acceptable use of assets"],
  ["A.5.11", "Return of assets"],
  ["A.5.12", "Information classification"],
  ["A.5.13", "Information labelling"],
  ["A.5.14", "Information transfer"],
  ["A.5.15", "Access control"],
  ["A.5.16", "Identity management"],
  ["A.5.17", "Authentication information"],
  ["A.5.18", "Access rights"],
  ["A.5.19", "Security in supplier relationships"],
  ["A.5.20", "Security in supplier agreements"],
  ["A.5.21", "ICT supply chain security"],
  ["A.5.22", "Supplier service monitoring and change"],
  ["A.5.23", "Security of cloud services"],
  ["A.5.24", "Incident management planning"],
  ["A.5.25", "Assessing security events"],
  ["A.5.26", "Incident response"],
  ["A.5.27", "Learning from incidents"],
  ["A.5.28", "Evidence collection"],
  ["A.5.29", "Security during disruption"],
  ["A.5.30", "ICT readiness for continuity"],
  ["A.5.31", "Legal and contractual requirements"],
  ["A.5.32", "Intellectual property rights"],
  ["A.5.33", "Protection of records"],
  ["A.5.34", "Privacy and PII protection"],
  ["A.5.35", "Independent security review"],
  ["A.5.36", "Compliance with policies and standards"],
  ["A.5.37", "Documented operating procedures"]
];

const PEOPLE = [
  ["A.6.1", "Screening"],
  ["A.6.2", "Employment terms and conditions"],
  ["A.6.3", "Security awareness and training"],
  ["A.6.4", "Disciplinary process"],
  ["A.6.5", "Duties after termination or change"],
  ["A.6.6", "Confidentiality agreements"],
  ["A.6.7", "Remote working"],
  ["A.6.8", "Reporting security events"]
];

const PHYSICAL = [
  ["A.7.1", "Physical security perimeters"],
  ["A.7.2", "Physical entry controls"],
  ["A.7.3", "Securing offices and facilities"],
  ["A.7.4", "Physical security monitoring"],
  ["A.7.5", "Physical and environmental threats"],
  ["A.7.6", "Working in secure areas"],
  ["A.7.7", "Clear desk and clear screen"],
  ["A.7.8", "Equipment siting and protection"],
  ["A.7.9", "Off-premises asset security"],
  ["A.7.10", "Storage media"],
  ["A.7.11", "Supporting utilities"],
  ["A.7.12", "Cabling security"],
  ["A.7.13", "Equipment maintenance"],
  ["A.7.14", "Secure disposal or reuse of equipment"]
];

const TECHNOLOGICAL = [
  ["A.8.1", "User endpoint devices"],
  ["A.8.2", "Privileged access rights"],
  ["A.8.3", "Information access restriction"],
  ["A.8.4", "Access to source code"],
  ["A.8.5", "Secure authentication"],
  ["A.8.6", "Capacity management"],
  ["A.8.7", "Malware protection"],
  ["A.8.8", "Technical vulnerability management"],
  ["A.8.9", "Configuration management"],
  ["A.8.10", "Information deletion"],
  ["A.8.11", "Data masking"],
  ["A.8.12", "Data leakage prevention"],
  ["A.8.13", "Information backup"],
  ["A.8.14", "Redundancy of processing facilities"],
  ["A.8.15", "Logging"],
  ["A.8.16", "Monitoring activities"],
  ["A.8.17", "Clock synchronization"],
  ["A.8.18", "Privileged utility programs"],
  ["A.8.19", "Software installation on operational systems"],
  ["A.8.20", "Network security"],
  ["A.8.21", "Security of network services"],
  ["A.8.22", "Network segregation"],
  ["A.8.23", "Web filtering"],
  ["A.8.24", "Use of cryptography"],
  ["A.8.25", "Secure development life cycle"],
  ["A.8.26", "Application security requirements"],
  ["A.8.27", "Secure architecture principles"],
  ["A.8.28", "Secure coding"],
  ["A.8.29", "Security testing in development"],
  ["A.8.30", "Outsourced development"],
  ["A.8.31", "Separate dev, test and production"],
  ["A.8.32", "Change management"],
  ["A.8.33", "Test data"],
  ["A.8.34", "Protecting systems during audit testing"]
];

function tag(rows, category) {
  return rows.map(function(row) { return { id: row[0], title: row[1], category: category }; });
}

export default {
  frameworkId: "ISO 27001:2022",
  listStatus: "draft",
  controls: [].concat(
    tag(ORGANIZATIONAL, "organizational"),
    tag(PEOPLE, "people"),
    tag(PHYSICAL, "physical"),
    tag(TECHNOLOGICAL, "technological")
  )
};
