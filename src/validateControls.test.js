/**
 * @jest-environment node
 */
import { validateControls, NO_LIST_BANNER } from "../api/_validateControls";
import { FRAMEWORKS } from "../api/_prompts";
import { CONTROL_LISTS } from "../api/controls";

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

  test("only ISO 27001:2022 and SOC 2 have lists so far", () => {
    const withList = FRAMEWORKS.filter((fw) => validateControls(fw, []).hasList);
    expect(withList).toEqual([ISO, "SOC 2 Type I", "SOC 2 Type II"]);
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
