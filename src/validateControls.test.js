/**
 * @jest-environment node
 */
import { validateControls, NO_LIST_BANNER } from "../api/_validateControls";
import { FRAMEWORKS } from "../api/_prompts";
import { CONTROL_LISTS } from "../api/controls";
import { normalizeNist80053Id } from "../api/controls/normalize";

const ISO = "ISO 27001:2022";
const statuses = (framework, ids) =>
  validateControls(framework, ids.map((id) => ({ id }))).controls.map((c) => c.status);

describe("validateControls: ISO 27001:2022", () => {
  test("2013-style A.12.4.1 to A.12.4.4 are not valid under 2022", () => {
    expect(statuses(ISO, ["A.12.4.1", "A.12.4.2", "A.12.4.3", "A.12.4.4"])).toEqual(Array(4).fill("unverified"));
  });

  test("any three-level ID is not valid under 2022", () => {
    expect(statuses(ISO, ["A.9.4.2", "A.5.1.1", "A.8.3.2", "A.18.1.4"])).toEqual(Array(4).fill("unverified"));
  });

  test("A.8.3.2 is flagged (A.8.3 has no sub-numbers)", () => {
    expect(statuses(ISO, ["A.8.3.2"])).toEqual(["unverified"]);
  });

  test("A.5.3, A.8.15, A.8.16 and A.8.17 are accepted", () => {
    expect(statuses(ISO, ["A.5.3", "A.8.15", "A.8.16", "A.8.17"])).toEqual(Array(4).fill("listed"));
  });

  test("IDs outside Annex A (clauses, bad numbers) are unverified", () => {
    expect(statuses(ISO, ["6.1.2", "A.8.35", "A.5.38", "A.4.1", "A.12"])).toEqual(Array(5).fill("unverified"));
  });

  test("matching is exact apart from surrounding whitespace", () => {
    expect(statuses(ISO, [" A.5.3 ", "a.5.3", "A.5.3."])).toEqual(["listed", "unverified", "unverified"]);
  });

  test("missing, non-string, and non-object entries are unverified, not errors", () => {
    const out = validateControls(ISO, [{}, { id: 53 }, { id: null }, null, "A.5.3"]);
    expect(out.controls.map((c) => c.status)).toEqual(Array(5).fill("unverified"));
  });

  test("reports the list status (draft) and no banner; does not touch the input", () => {
    const input = [{ id: "A.5.3", name: "Segregation of duties" }];
    const copy = JSON.parse(JSON.stringify(input));
    const out = validateControls(ISO, input);
    expect(out).toMatchObject({ frameworkId: ISO, hasList: true, listStatus: "draft", banner: null });
    expect(out.controls).toEqual([{ id: "A.5.3", status: "listed" }]);
    expect(input).toEqual(copy);
  });

  test("a non-array controls value gives an empty result", () => {
    expect(validateControls(ISO, undefined).controls).toEqual([]);
  });
});

describe("validateControls: frameworks without a list", () => {
  test("get the whole-result banner and no per-control verdict", () => {
    const out = validateControls("PCI DSS v4.0", [{ id: "8.3" }, { id: "10.2.1" }]);
    expect(out).toMatchObject({ hasList: false, listStatus: null, banner: "AI-generated, verify control IDs before use." });
    expect(out.controls.map((c) => c.status)).toEqual(["unchecked", "unchecked"]);
  });

  test("NIST SP 800-171 and CMMC 2.0 have no list (they do not reuse 800-53)", () => {
    ["NIST SP 800-171", "CMMC 2.0"].forEach((fw) => {
      expect(validateControls(fw, [{ id: "AC-2" }]).banner).toBe(NO_LIST_BANNER);
    });
  });

  test("an unknown framework is treated as having no list", () => {
    expect(validateControls("Made Up 1.0", [{ id: "X" }]).banner).toBe(NO_LIST_BANNER);
    expect(validateControls("constructor", [{ id: "X" }]).banner).toBe(NO_LIST_BANNER);
  });

  test("only NIST 800-53, ISO 27001:2022 and SOC 2 have lists so far", () => {
    const withList = FRAMEWORKS.filter((fw) => validateControls(fw, []).hasList);
    expect(withList).toEqual(["NIST SP 800-53 Rev 5", ISO, "SOC 2 Type I", "SOC 2 Type II"]);
  });
});

describe("validateControls: SOC 2 (read-only use of the existing criteria)", () => {
  test("known criteria are listed, unknown ones unverified, for both report types", () => {
    ["SOC 2 Type I", "SOC 2 Type II"].forEach((fw) => {
      expect(statuses(fw, ["CC6.1", "PI1.1", "P8.1", "CC6.99", "A.5.3"])).toEqual(["listed", "listed", "listed", "unverified", "unverified"]);
      expect(validateControls(fw, []).listStatus).toBe("verified");
    });
  });

  test("the SOC 2 list has all 61 criteria", () => {
    expect(CONTROL_LISTS["SOC 2 Type I"].controls).toHaveLength(61);
  });
});

describe("validateControls: NIST SP 800-53 Rev 5", () => {
  const NIST = "NIST SP 800-53 Rev 5";

  test("current controls and enhancements are listed, and the list is verified", () => {
    const out = validateControls(NIST, [{ id: "AC-2" }, { id: "AC-2(1)" }, { id: "SI-7(17)" }]);
    expect(out).toMatchObject({ hasList: true, listStatus: "verified", banner: null });
    expect(out.controls.map((c) => c.status)).toEqual(["listed", "listed", "listed"]);
  });

  test("case and zero-padding are ignored", () => {
    expect(statuses(NIST, ["ac-2", "AC-02", "AC-02(01)", " ac-2(1) "])).toEqual(Array(4).fill("listed"));
  });

  test("made-up IDs, the dotted form, and other spellings are unverified", () => {
    expect(statuses(NIST, ["AC-99", "AC-2.1", "AC-2 (1)", "AC-2(99)", "XX-1", "A.8.15", "CC6.1"])).toEqual(Array(7).fill("unverified"));
  });

  test("withdrawn controls are not valid", () => {
    expect(statuses(NIST, ["AC-13", "AC-2(10)", "AC-3(1)"])).toEqual(Array(3).fill("unverified"));
  });

  test("the model's spelling is returned as given", () => {
    expect(validateControls(NIST, [{ id: "ac-02" }]).controls).toEqual([{ id: "ac-02", status: "listed" }]);
  });

  test("normalizeNist80053Id", () => {
    expect(normalizeNist80053Id(" ac-02(01) ")).toBe("AC-2(1)");
    expect(normalizeNist80053Id("AC-10")).toBe("AC-10");
    expect(normalizeNist80053Id("AC-2.1")).toBe("AC-2.1");
  });

  test("NIST SP 800-171, CMMC 2.0 and CSF 2.0 do not borrow the 800-53 list", () => {
    ["NIST SP 800-171", "CMMC 2.0", "NIST CSF 2.0"].forEach((fw) => {
      expect(validateControls(fw, [{ id: "AC-2" }]).banner).toBe(NO_LIST_BANNER);
    });
  });
});
