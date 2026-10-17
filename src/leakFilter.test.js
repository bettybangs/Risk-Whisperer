/**
 * @jest-environment node
 */
import { stripLeakedPhrases, EMPTY_RATIONALE, LEAKED_PHRASES } from "../api/_leakFilter";

beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => console.warn.mockRestore());

describe("stripLeakedPhrases", () => {
  test("removes the sentence containing a leaked phrase and keeps the rest", () => {
    const out = stripLeakedPhrases({
      rationale: "Logs are forwarded to a central workspace. Not included based on the strict inclusion rule. Retention is 90 days."
    });
    expect(out.rationale).toBe("Logs are forwarded to a central workspace. Retention is 90 days.");
  });

  test("is case-insensitive and tolerates extra whitespace", () => {
    ["STRICT INCLUSION RULE", "Strict   Inclusion\nRule", "inclusion rule", "NOT INCLUDED BASED ON the input"].forEach((phrase) => {
      expect(stripLeakedPhrases({ rationale: "Keep this. See the " + phrase + " here." }).rationale).toBe("Keep this.");
    });
  });

  test("covers every listed phrase, in any string field, at any depth", () => {
    LEAKED_PHRASES.forEach((phrase) => {
      const out = stripLeakedPhrases({ a: { b: ["Fine. Leaked: " + phrase + "."] }, riskJustification: "Ok. " + phrase + "." });
      expect(out.a.b).toEqual(["Fine."]);
      expect(out.riskJustification).toBe("Ok.");
    });
  });

  test("normal sentences survive unchanged, including IDs with periods and similar words", () => {
    const input = {
      controlMappings: [{ id: "A.8.15", name: "Logging", rationale: "Diagnostic logs go to a central workspace. Rules for inclusion in the allowlist are documented. The conclusion rule set is reviewed quarterly." }],
      assessmentQuestions: ["How are exclusions from the alerting rule set approved?", "Is A.8.16 monitoring in place?"],
      overallRiskScore: 4,
      note: null
    };
    expect(stripLeakedPhrases(JSON.parse(JSON.stringify(input)))).toEqual(input);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("a rationale that was only leaked wording gets a neutral fallback and the control stays", () => {
    const out = stripLeakedPhrases({
      controlMappings: [{ id: "A.8.3.2", name: "Segregation of duties", rationale: "Not included based on the strict inclusion rule" }]
    });
    expect(out.controlMappings).toEqual([{ id: "A.8.3.2", name: "Segregation of duties", rationale: EMPTY_RATIONALE }]);
  });

  test("a list entry that was only leaked wording is removed, not left blank", () => {
    expect(stripLeakedPhrases({ assessmentQuestions: ["Q1?", "Excluded by the inclusion rule.", "Q2?"] }).assessmentQuestions).toEqual(["Q1?", "Q2?"]);
  });

  test("logs the changed field paths, not the whole reply", () => {
    stripLeakedPhrases({ controlMappings: [{ rationale: "A. The strict inclusion rule applies." }], riskJustification: "Clean." });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn.mock.calls[0][1]).toEqual({ fields: ["controlMappings[0].rationale"] });
  });

  test("leaves keys and non-string values alone", () => {
    const input = { "inclusion rule": 3, ok: true, n: null, arr: [1, 2] };
    expect(stripLeakedPhrases(input)).toEqual(input);
  });
});
