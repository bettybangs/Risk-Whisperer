import { useState } from "react";

const FRAMEWORKS = [
  "NIST SP 800-53 Rev 5",
  "NIST CSF 2.0",
  "FedRAMP Moderate",
  "FedRAMP High",
  "CIS Controls v8",
  "ISO 27001:2022",
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
  @media print { .no-print { display: none !important; } body { background: white !important; color: black !important; } }
`;

export default function App() {
  const [input, setInput] = useState("");
  const [env, setEnv] = useState("AWS");
  const [framework, setFramework] = useState("NIST SP 800-53 Rev 5");
  const [family, setFamily] = useState("Any (Auto-detect)");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState("");

  async function assess() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      var familyHint = family !== "Any (Auto-detect)" ? " Focus on the " + family + " control family." : "";
      var res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: "You are a senior GRC analyst and security control assessor specializing in " + env + " cloud environments and " + framework + " compliance." + familyHint + " Return ONLY valid JSON (no markdown, no backticks) with these exact keys: assessmentQuestions (array of 6-8 specific interview questions an auditor would ask), evidenceToCollect (array of 6-8 specific artifacts/screenshots/logs to request), potentialWeaknesses (array of 4-6 objects with {name, description, severity, recommendation} where severity is High/Medium/Low), nistControls (array of 5-8 objects with {id, name, rationale}), overallRiskScore (a number 1-10 where 10 is highest risk), riskJustification (2-3 sentence explanation of the score), controlMaturity (one of: Initial/Developing/Defined/Managed/Optimizing), maturityJustification (1-2 sentence explanation). Be specific to " + env + " services and " + framework + " requirements.",
          messages: [{ role: "user", content: "Assess this security control:\n\n" + input }]
        })
      });
      var data = await res.json();
      if (data.error) throw new Error(data.error.message);
      var text = data.content.find(function(b) { return b.type === "text"; })?.text || "";
      var parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
      setHistory(function(prev) {
        return [{ input: input.substring(0, 80) + "...", env: env, framework: framework, result: parsed, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)];
      });
    } catch (e) {
  if (e.message?.includes("401") || e.message?.includes("invalid x-api-key") || e.message?.includes("authentication")) {
    setError("Invalid API key. Check your REACT_APP_ANTHROPIC_API_KEY in .env");
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
                <button onClick={function() { window.print(); }} style={{ background: "none", border: "1px solid #444", color: "#888", fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                  Export PDF
                </button>
              )}
              {history.length > 0 && (
                <button onClick={function() { setShowHistory(!showHistory); setShowHelp(false); }} style={{ background: "none", border: "1px solid #444", color: "#888", fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                  History ({history.length})
                </button>
              )}
            </div>
          </div>

          <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0.5rem 0 0 rem", color: "#f5ead8" }}>Risk Whisperer</h1>
          <p style={{ color: "#aaa", marginBottom: "-0.5rem", fontSize: 16 }}>Know your risks before your auditor does.</p>
<p style={{ color: "#555", marginBottom: "1.5rem", fontSize: 12 }}>AI-powered security control assessor · {framework} · {env}</p>

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
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 0.5rem", letterSpacing: "0.06em" }}>UNDERSTANDING YOUR RESULTS</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["Risk Score", "1-3 = Low risk, 4-6 = Medium, 7-10 = High. Based on gaps identified in the control description."],
                  ["Control Maturity", "Rates how mature and repeatable the control is, from Initial (ad-hoc) to Optimizing (continuously improving)."],
                  ["Assessment Questions", "Interview questions to ask the control owner during a formal audit or assessment."],
                  ["Evidence to Collect", "Specific screenshots, logs, and documents to request as audit evidence."],
                  ["Weaknesses", "Security gaps identified in the control, rated High/Medium/Low with remediation steps."],
                  ["Control Mappings", "Official framework controls that apply. Click any tag to open the NIST reference page."]
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
                    <div key={i} className="history-item" onClick={function() { setInput(item.input.replace("...", "")); setEnv(item.env); setFramework(item.framework); setResult(item.result); setShowHistory(false); }}>
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
            <button onClick={assess} disabled={loading || !input.trim()} className="assess-btn"
              style={{ width: "100%", marginTop: 12, padding: "0.75rem", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
              {loading ? (
  <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
    Analyzing control
    <span className="dot1" style={{fontSize:18,lineHeight:1}}>.</span>
    <span className="dot2" style={{fontSize:18,lineHeight:1}}>.</span>
    <span className="dot3" style={{fontSize:18,lineHeight:1}}>.</span>
  </span>
) : "Assess control"}
            </button>
          </div>

          {error && (
            <div style={{ background: "#2a1a1a", border: "1px solid #5a2a2a", borderRadius: 8, padding: "0.75rem 1rem", color: "#c07070", fontSize: 13, marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, padding: "1.25rem" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>OVERALL RISK SCORE</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 48, fontWeight: 700, color: riskColor, lineHeight: 1 }}>{result.overallRiskScore}</span>
                    <span style={{ fontSize: 16, color: "#444" }}>/10</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#777", margin: "0.5rem 0 0", lineHeight: 1.6 }}>{result.riskJustification}</p>
                </div>
                <div style={{ background: "#242424", border: "1px solid #333", borderRadius: 12, padding: "1.25rem" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>CONTROL MATURITY</p>
                  <span style={{ fontSize: 28, fontWeight: 700, color: maturityColors[result.controlMaturity] || "#6eccc0" }}>{result.controlMaturity}</span>
                  <p style={{ fontSize: 12, color: "#777", margin: "0.5rem 0 0", lineHeight: 1.6 }}>{result.maturityJustification}</p>
                </div>
              </div>

              <Card title="Assessment questions" accent="#d4902a" onCopy={function() { copySection(result.assessmentQuestions.join("\n"), "questions"); }} copied={copied === "questions"}>
                <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.assessmentQuestions.map(function(q, i) {
                    return <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#d8c8a8" }}>{q}</li>;
                  })}
                </ul>
              </Card>

              <Card title="Evidence to collect" accent="#6eccc0" onCopy={function() { copySection(result.evidenceToCollect.join("\n"), "evidence"); }} copied={copied === "evidence"}>
                <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.evidenceToCollect.map(function(e, i) {
                    return <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#d8c8a8" }}>{e}</li>;
                  })}
                </ul>
              </Card>

              <Card title="Potential weaknesses & recommendations" accent="#e07030" onCopy={function() { copySection(result.potentialWeaknesses.map(function(w) { return w.name + " (" + w.severity + "): " + w.description + " Recommendation: " + w.recommendation; }).join("\n\n"), "weaknesses"); }} copied={copied === "weaknesses"}>
                {result.potentialWeaknesses.map(function(w, i) {
                  var sevBg = w.severity === "High" ? "#3a1a0a" : w.severity === "Medium" ? "#2a2a0a" : "#0a2a2a";
                  var sevColor = w.severity === "High" ? "#e07030" : w.severity === "Medium" ? "#c8a830" : "#50b8b0";
                  var sevBorder = w.severity === "High" ? "#7a3a10" : w.severity === "Medium" ? "#6a5a10" : "#1a6a60";
                  return (
                    <div key={i} style={{ padding: "0.75rem 0", borderBottom: i < result.potentialWeaknesses.length - 1 ? "1px solid #2a2a2a" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#f5ead8" }}>{w.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99, background: sevBg, color: sevColor, border: "1px solid " + sevBorder, marginLeft: "auto" }}>{w.severity}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, margin: "0 0 6px" }}>{w.description}</p>
                      <p style={{ fontSize: 12, color: "#6eccc0", lineHeight: 1.6, margin: 0 }}><strong style={{ color: "#6eccc0" }}>Recommendation: </strong>{w.recommendation}</p>
                    </div>
                  );
                })}
              </Card>

              <Card title={framework + " control mappings"} accent="#c8a830" onCopy={function() { copySection(result.nistControls.map(function(c) { return c.id + " - " + c.name + ": " + c.rationale; }).join("\n\n"), "controls"); }} copied={copied === "controls"}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {result.nistControls.map(function(c, i) {
                    return (
                      <a key={i} className="nist-tag" href={"https://csrc.nist.gov/projects/cprt/catalog#/cprt/framework/version/SP_800_53_5_1_0/home?element=" + c.id} target="_blank" rel="noreferrer">{c.id}</a>
                    );
                  })}
                </div>
                <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.nistControls.map(function(c, i) {
                    return (
                      <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#d8c8a8" }}>
                        <strong style={{ color: "#f5ead8" }}>{c.id} - {c.name}:</strong> {c.rationale}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
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
