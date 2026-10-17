/**
 * @jest-environment node
 */
import iso from "../api/controls/iso-27001-2022";

const byCategory = (cat) => iso.controls.filter((c) => c.category === cat);

describe("ISO 27001:2022 Annex A control list", () => {
  test("is marked verified after the owner's check against the standard", () => {
    expect(iso.frameworkId).toBe("ISO 27001:2022");
    expect(iso.listStatus).toBe("verified");
    expect(iso.verified).toContain("2026-10-17");
  });

  test("records the secondary-source cross-check and says it is not verified against the standard", () => {
    expect(iso.crossChecked).toContain("2026-10-17");
    expect(iso.crossChecked).toContain("Not verified against the standard.");
  });

  test("has 93 controls split 37 / 8 / 14 / 34 by category", () => {
    expect(iso.controls).toHaveLength(93);
    expect(byCategory("organizational")).toHaveLength(37);
    expect(byCategory("people")).toHaveLength(8);
    expect(byCategory("physical")).toHaveLength(14);
    expect(byCategory("technological")).toHaveLength(34);
  });

  test("IDs are contiguous within each theme: A.5.1-37, A.6.1-8, A.7.1-14, A.8.1-34", () => {
    const expected = { organizational: [5, 37], people: [6, 8], physical: [7, 14], technological: [8, 34] };
    Object.keys(expected).forEach((cat) => {
      const [theme, count] = expected[cat];
      const ids = byCategory(cat).map((c) => c.id);
      const want = Array.from({ length: count }, (_, i) => "A." + theme + "." + (i + 1));
      expect(ids).toEqual(want);
    });
  });

  test("IDs are unique, two-level, and every entry has a title", () => {
    const ids = iso.controls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    iso.controls.forEach((c) => {
      expect(c.id).toMatch(/^A\.[5-8]\.[1-9][0-9]?$/);
      expect(c.title.trim()).not.toBe("");
    });
  });

  test("contains the 2022 controls the user confirmed and none of the invalid IDs", () => {
    const ids = new Set(iso.controls.map((c) => c.id));
    ["A.5.3", "A.8.3", "A.8.15", "A.8.16", "A.8.17"].forEach((id) => expect(ids.has(id)).toBe(true));
    ["A.8.3.2", "A.12.4.1", "A.12.4.2", "A.12.4.3", "A.12.4.4"].forEach((id) => expect(ids.has(id)).toBe(false));
  });
});
