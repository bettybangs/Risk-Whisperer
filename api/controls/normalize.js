// Per-framework ID normalizers. validateControls runs the model's ID through
// the framework's normalizer, if it has one, before looking it up. Without
// one, only surrounding whitespace is ignored.

// NIST SP 800-53 prints AC-2 and AC-2(1), and also zero-padded AC-02 and
// AC-02(01). Those are the same IDs, so case and zero-padding are ignored.
// Other spellings (AC-2.1, AC-2 (1)) are left as they are and will not match.
export function normalizeNist80053Id(id) {
  var upper = String(id).trim().toUpperCase();
  var m = upper.match(/^([A-Z]{2})-0*(\d+)(?:\(0*(\d+)\))?$/);
  if (!m) return upper;
  return m[1] + "-" + m[2] + (m[3] !== undefined ? "(" + m[3] + ")" : "");
}
