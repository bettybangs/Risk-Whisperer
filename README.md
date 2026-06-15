# Risk Whisperer

### AI-Powered Security Control Assessor

Risk Whisperer is a GRC portfolio tool that uses Claude AI to assess security controls against major compliance frameworks. Paste in a control description or system detail and instantly receive assessment questions, evidence requirements, potential weaknesses with remediation recommendations, and framework control mappings — the same outputs a senior GRC analyst would produce manually.

![Risk Whisperer Screenshot](Risk Whisperer-screenshot.png)

---


## What It Does

| Output | What It Means |
|---|---|
| Risk Score (1-10) | Overall risk level of the described control |
| Control Maturity | How mature the control is (Initial → Optimizing) |
| Assessment Questions | Interview questions an auditor would ask |
| Evidence to Collect | Artifacts and screenshots needed for an audit package |
| Weaknesses & Recommendations | Gaps identified with specific remediation steps |
| Framework Mappings | Which official controls apply, with rationale |

---

## Supported Frameworks

- NIST SP 800-53 Rev 5
- NIST CSF 2.0
- FedRAMP Moderate / High
- CIS Controls v8
- ISO 27001:2022
- SOC 2 Type II
- PCI DSS v4.0
- HIPAA Security Rule
- CMMC 2.0
- CISA Zero Trust Maturity Model
- NIST SP 800-171
- NERC CIP
- GDPR

## Supported Cloud Environments

AWS · AWS GovCloud · Azure · Azure Government · GCP · Oracle Cloud (OCI) · Multi-cloud · Hybrid · On-premises

---

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- An Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/bettybangs/Risk Whisperer.git
   cd Risk Whisperer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add your API key**

   Create a `.env` file in the root folder:
   ```
   REACT_APP_ANTHROPIC_API_KEY=your-api-key-here
   ```

4. **Start the app**
   ```bash
   npm start
   ```

   The app opens at `http://localhost:3000`

---

## How to Use

1. **Paste a control description** into the text box — describe a security policy, system configuration, or control implementation
2. **Select your cloud environment** from the dropdown
3. **Select your compliance framework**
4. **Optionally select a control family** to focus the assessment
5. **Click Assess control**
6. Review your results — copy individual sections or export the full report as PDF

### Example Input
```
Our AWS environment uses IAM roles with least-privilege policies attached to all 
EC2 instances and Lambda functions. There are no IAM users with programmatic access 
keys in production. MFA is enforced on all human IAM users via a Service Control 
Policy at the AWS Organizations level. CloudTrail is enabled in all regions with 
logs shipped to a centralized S3 bucket with Object Lock enabled.
```

---

## Built With

- [React](https://reactjs.org/)
- [Claude API](https://www.anthropic.com/) (claude-sonnet-4-6)
- [Create React App](https://create-react-app.dev/)

---

## About

Built by Beth Gerharts as a GRC portfolio project demonstrating AI-assisted security control assessment for cloud environments.

- [LinkedIn](https://linkedin.com/in/beth-gerharts)
- [GitHub](https://github.com/bettybangs)

---

## Disclaimer

Risk Whisperer is a portfolio and educational tool. Outputs should be reviewed by a qualified GRC professional before use in a formal audit or compliance program.
