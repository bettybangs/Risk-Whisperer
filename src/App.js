import React, { useState } from "react";
import "./App.css";

const FRAMEWORK_REFERENCES = {
  "SOC 2":
    "Map inputs to SOC 2 Trust Services Criteria (2017 TSC). Use native CC-series IDs (e.g., CC6.1, CC6.8, CC7.1) and Confidentiality/Privacy IDs (e.g., C1.1, P1.1). Do not use NIST or ISO identifiers.",
  "ISO 27001":
    "Map inputs to ISO/IEC 27001:2022 Annex A controls. Use native Annex A numbering (e.g., A.5.1, A.8.7, A.8.8). Do not use NIST or SOC 2 identifiers.",
  "NIST SP 800-53":
    "Map inputs to NIST SP 800-53 Rev. 5 controls. Use native family identifiers (e.g., AC-2, IA-5, SI-4, SC-7). Do not use SOC 2 or ISO identifiers.",
  "PCI DSS v4.0":
    "Map inputs to PCI DSS v4.0 principal requirements. Use native requirement numbering (e.g., 1.2, 6.3, 8.3, 10.2). Do not use NIST or SOC 2 identifiers.",
  "HIPAA Security Rule":
    "Map inputs to HIPAA Security Rule standards. Use native section numbers (e.g., 164.308(a)(1), 164.312(a)(1)). Do not use NIST or SOC 2 identifiers.",
  "CIS Controls v8":
    "Map inputs to CIS Critical Security Controls v8. Use native CIS Safeguard IDs (e.g., CIS 1.1, CIS 3.3, CIS 10.1). Do not use NIST or SOC 2 identifiers.",
};

const SOC2_GROUNDED_DEFINITIONS = {
  "CC6.1":
    "Logical access security measures block unauthorized access, but this control specifically governs system boundary access controls and perimeter protection. Do NOT map CC6.1 for internal endpoint management, internal patch management, internal software updates, or general vulnerability scanning.",
  "CC6.8":
    "Prevents or detects malicious software. Do NOT map CC6.8 for generic system patches or OS updates unless explicit anti-malware measures (like AV or EDR) are mentioned.",
  "CC7.1":
    "Infrastructure and software monitoring detects security anomalies. Do NOT map CC7.1 for routine software patch installations unless active monitoring or logging of anomalies is explicitly detailed.",
  "C1.1":
    "Maintains an inventory of confidential data assets and locations. Do NOT map C1.1 for routine data destruction, wiping, or disposal procedures unless asset identification/classification inventories are explicitly described.",
  "C1.2":
    "Governs the secure disposal and destruction of confidential information to prevent unauthorized recovery.",
};

function App() {
  const [input, setInput] = useState("");
  const [framework, setFramework] = useState("SOC 2");
  const [env, setEnv] = useState("AWS");
  const [family, setFamily] = useState("Any (Auto-detect)");
  const [result, setResult] = useState(null);
  const [plainResult, setPlainResult] = useState(null);
  const [viewMode, setViewMode] = useState("tech");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAssess = async () => {
    if (!input.trim()) return;
    setError(null);
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

    if (suspiciousPatterns.some((p) => p.test(input))) {
      setError(
        "Input contains unsupported content. Please describe a security control or system configuration."
      );
      setLoading(false);
      return;
    }

    try {
      var familyHint =
        family !== "Any (Auto-detect)"
          ? " Focus on the " + family + " control family."
          : "";
      var res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 6000,
          system:
            "You are a senior GRC analyst and security control assessor specializing in " +
            env +
            " cloud environments and " +
            framework +
            " compliance." +
            familyHint +
            (FRAMEWORK_REFERENCES[framework]
              ? " " + FRAMEWORK_REFERENCES[framework]
              : "") +
            " Return ONLY valid JSON (no markdown, no backticks) with these exact keys: assessmentQuestions (array of 6-8 specific interview questions an auditor would ask), evidenceToCollect (array of 6-8 specific artifacts/screenshots/logs to request), potentialWeaknesses (array of 4-6 objects with {name, description, severity, recommendation} where severity is High/Medium/Low), controlMappings (array of 3-6 objects with {id, name, rationale}, using control identifiers native to the selected framework — e.g., CC-series like CC6.1 for SOC 2, Annex A numbering like A.9.4.2 for ISO 27001, requirement numbers like 8.3 for PCI DSS, AC-2 style IDs only for NIST-based frameworks — never default to NIST numbering for a non-NIST framework. STRICT INCLUSION RULE: only include a control if the input text directly and specifically describes an activity, system, or process that control governs. Do NOT include a control because it is commonly associated with the topic, because a related control might also be relevant, or because the organization 'should' or 'must' also have that control in place — if the input doesn't describe it, leave it out. Do NOT include a control based on an inferred gap or missing control ('no evidence of X' is a reason to exclude, not include). Every rationale must cite the specific words or facts from the input that justify that control's inclusion — if you cannot point to something explicitly stated in the input, do not include the control.)",
          messages: [{ role: "user", content: "Assess this security control: \n\n " + input }],
        }),
      });

      var data = await res.json();
      if (data.error) throw new Error(data.error.message);

      var text =
        data.content.find(function (b) {
          return b.type === "text";
        })?.text || "";
      var parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

      var flagged = (parsed.controlMappings || []).filter(function (c) {
        return SOC2_GROUNDED_DEFINITIONS[c.id];
      });

      if (flagged.length > 0) {
        var defsText = flagged
          .map(function (c) {
            return c.id + ": " + SOC2_GROUNDED_DEFINITIONS[c.id];
          })
          .join("\n");

        try {
          var groundRes = await fetch("/api/assess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 500,
              system:
                "You are a precise GRC writer. For each control below, you are given its VERIFIED, AUTHORITATIVE definition from the real AICPA source, plus the situation being assessed. Write a 1-2 sentence rationale for each control using ONLY what its verified definition actually covers. If the definition includes a 'Do NOT' instruction, you must not include that excluded concept anywhere in your rationale, even in passing or as a secondary point — treat it as a hard constraint, not a style preference. Return ONLY valid JSON (no markdown, no backticks): an array of objects with keys {id, rationale}.\n\nVerified control definitions:\n" +
                defsText,
              messages: [
                {
                  role: "user",
                  content: "Situation being assessed:\n\n" + input,
                },
              ],
            }),
          });

          var groundData = await groundRes.json();
          if (!groundData.error) {
            var groundText =
              groundData.content.find(function (b) {
                return b.type === "text";
              })?.text || "";
            var grounded = JSON.parse(
              groundText.replace(/```json|```/g, "").trim()
            );
            var groundedMap = {};
            grounded.forEach(function (g) {
              groundedMap[g.id] = g.rationale;
            });
            parsed.controlMappings = parsed.controlMappings.map(function (c) {
              return groundedMap[c.id]
                ? { ...c, rationale: groundedMap[c.id] }
                : c;
            });
          }
        } catch (e) {
          // grounding call failed — keep original rationale
        }
      }

      parsed.potentialWeaknesses = parsed.potentialWeaknesses.map(function (
        w,
        i
      ) {
        return {
          ...w,
          id: framework + "-" + env + "-" + i + "-" + Date.now(),
        };
      });

      setResult(parsed);
    } catch (err) {
      setError(err.message || "An error occurred while assessing the control.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Risk Whisperer</h1>
        <p>Security Control & Compliance Assessor</p>
      </header>
      <main className="App-main">
        <section className="input-section">
          <label htmlFor="control-input">Describe Security Control / Implementation:</label>
          <textarea
            id="control-input"
            rows="6"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., When customer data reaches the end of its retention period, we securely wipe it from our AWS storage and confirm destruction."
          />
          <div className="selectors">
            <div>
              <label>Framework:</label>
              <select value={framework} onChange={(e) => setFramework(e.target.value)}>
                <option value="SOC 2">SOC 2</option>
                <option value="ISO 27001">ISO 27001</option>
                <option value="NIST SP 800-53">NIST SP 800-53</option>
                <option value="PCI DSS v4.0">PCI DSS v4.0</option>
                <option value="HIPAA Security Rule">HIPAA Security Rule</option>
                <option value="CIS Controls v8">CIS Controls v8</option>
              </select>
            </div>
            <div>
              <label>Environment:</label>
              <select value={env} onChange={(e) => setEnv(e.target.value)}>
                <option value="AWS">AWS</option>
                <option value="Azure">Azure</option>
                <option value="GCP">GCP</option>
                <option value="On-Premises">On-Premises</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <button onClick={handleAssess} disabled={loading}>
            {loading ? "Assessing..." : "Assess Control"}
          </button>
        </section>

        {error && <div className="error-box">{error}</div>}

        {result && (
          <section className="results-section">
            <h2>Assessment Results</h2>
            <div className="mappings">
              <h3>Control Mappings ({result.controlMappings?.length || 0})</h3>
              <ul>
                {result.controlMappings?.map((m) => (
                  <li key={m.id}>
                    <strong>{m.id} - {m.name}:</strong> {m.rationale}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
