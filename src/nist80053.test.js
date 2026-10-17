/**
 * @jest-environment node
 */
import nist from "../api/controls/nist-800-53-rev5";
import { catalogToList } from "../scripts/generate-nist-800-53-list";

describe("NIST SP 800-53 Rev 5 control list (generated from the OSCAL catalog)", () => {
  test("is marked verified and records where it came from", () => {
    expect(nist.frameworkId).toBe("NIST SP 800-53 Rev 5");
    expect(nist.listStatus).toBe("verified");
    expect(nist.source.repo).toBe("https://github.com/usnistgov/oscal-content");
    expect(nist.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(nist.source.tag).toBeTruthy();
    expect(nist.source.file).toContain("NIST_SP-800-53_rev5_catalog.json");
    expect(nist.source.catalogVersion).toBe("5.2.0");
    expect(nist.source.oscalVersion).toBeTruthy();
  });

  test("has 1,014 current controls: 300 base and 714 enhancements, in 20 families", () => {
    expect(nist.controls).toHaveLength(1014);
    expect(nist.controls.filter((c) => !c.id.includes("("))).toHaveLength(300);
    expect(nist.controls.filter((c) => c.id.includes("("))).toHaveLength(714);
    expect(new Set(nist.controls.map((c) => c.category)).size).toBe(20);
  });

  test("IDs are unique and written the way NIST prints them", () => {
    const ids = nist.controls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[A-Z]{2}-[1-9][0-9]*(\([1-9][0-9]*\))?$/));
    nist.controls.forEach((c) => expect(c.title.trim()).not.toBe(""));
    ["AC-2", "AC-2(1)", "SI-7(17)", "SR-12", "PT-8"].forEach((id) => expect(ids).toContain(id));
  });

  test("withdrawn controls are recorded separately and are not valid IDs", () => {
    expect(nist.withdrawn).toHaveLength(182);
    const valid = new Set(nist.controls.map((c) => c.id));
    nist.withdrawn.forEach((id) => expect(valid.has(id)).toBe(false));
    ["AC-13", "AC-2(10)", "AC-3(1)"].forEach((id) => expect(nist.withdrawn).toContain(id));
  });
});

describe("catalogToList (the generator's transform)", () => {
  const label = (v, cls) => (cls ? { name: "label", value: v, class: cls } : { name: "label", value: v });
  const catalog = (groups) => ({ catalog: { metadata: { version: "9.9.9", "oscal-version": "1.0.0", "last-modified": "t" }, groups } });
  const ctl = (id, plain, extra = {}) => ({ id, title: "T " + plain, props: [label(plain.replace(/(\D)(\d)$/, "$10$2"), "zero-padded"), label(plain), ...(extra.props || [])], controls: extra.controls });

  test("uses the plain label, nests enhancements, and sets withdrawn ones aside", () => {
    const out = catalogToList(catalog([{
      id: "ac", title: "Access Control",
      controls: [
        ctl("ac-2", "AC-2", { controls: [ctl("ac-2.1", "AC-2(1)"), ctl("ac-2.10", "AC-2(10)", { props: [{ name: "status", value: "withdrawn" }] })] }),
        ctl("ac-13", "AC-13", { props: [{ name: "status", value: "withdrawn" }] })
      ]
    }]));
    expect(out.controls).toEqual([
      { id: "AC-2", title: "T AC-2", category: "Access Control" },
      { id: "AC-2(1)", title: "T AC-2(1)", category: "Access Control" }
    ]);
    expect(out.withdrawn).toEqual(["AC-2(10)", "AC-13"]);
    expect(out.catalog).toEqual({ version: "9.9.9", oscalVersion: "1.0.0", lastModified: "t" });
  });

  test("fails loudly on duplicates, a missing label, or unexpected nesting", () => {
    expect(() => catalogToList(catalog([{ title: "F", controls: [ctl("ac-1", "AC-1"), ctl("ac-1", "AC-1")] }]))).toThrow(/Duplicate/);
    expect(() => catalogToList(catalog([{ title: "F", controls: [{ id: "ac-1", title: "t", props: [] }] }]))).toThrow(/plain label/);
    const deep = ctl("ac-1", "AC-1", { controls: [ctl("ac-1.1", "AC-1(1)", { controls: [ctl("ac-1.1.1", "AC-1(1)(1)")] })] });
    expect(() => catalogToList(catalog([{ title: "F", controls: [deep] }]))).toThrow(/nesting/);
  });
});
