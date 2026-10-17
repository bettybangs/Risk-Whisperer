// Output-side backstop for prompt wording that leaks into a reply.
//
// The assessment prompt tells the model not to repeat its internal rules, but
// it sometimes does anyway (for example "not included based on the strict
// inclusion rule"). This removes any sentence containing a known phrase from
// every string in the parsed reply. It is a safety net, not the main defence.

export const LEAKED_PHRASES = ["strict inclusion rule", "inclusion rule", "not included based on"];

// Shown in place of a rationale that was nothing but leaked wording.
export const EMPTY_RATIONALE = "No rationale provided.";

// Case-insensitive, tolerant of extra whitespace, whole words only. No "g"
// flag, so test() carries no state between calls.
var LEAK_PATTERN = new RegExp(
  LEAKED_PHRASES.map(function(p) { return "\\b" + p.replace(/ /g, "\\s+") + "\\b"; }).join("|"),
  "i"
);

// Drop the sentences that contain a leaked phrase. Sentences split on . ! ?
// followed by whitespace, so IDs like A.8.15 stay in one piece. Text with no
// leaked phrase is returned untouched.
function stripSentences(text) {
  if (!LEAK_PATTERN.test(text)) return text;
  return text.split(/(?<=[.!?])\s+/).filter(function(s) { return !LEAK_PATTERN.test(s); }).join(" ").trim();
}

function walk(value, path, key, hits) {
  if (typeof value === "string") {
    var cleaned = stripSentences(value);
    if (cleaned === value) return value;
    hits.push(path);
    // A rationale that was only leaked wording gets a neutral line, so the
    // control still shows with something readable. Other fields become "".
    return cleaned === "" && key === "rationale" ? EMPTY_RATIONALE : cleaned;
  }
  if (Array.isArray(value)) {
    var items = [];
    value.forEach(function(item, i) {
      var out = walk(item, path + "[" + i + "]", key, hits);
      // A list entry that was only leaked wording is removed, not left blank.
      if (!(typeof item === "string" && item !== "" && out === "")) items.push(out);
    });
    return items;
  }
  if (value !== null && typeof value === "object") {
    var obj = {};
    Object.keys(value).forEach(function(k) {
      obj[k] = walk(value[k], path ? path + "." + k : k, k, hits);
    });
    return obj;
  }
  return value;
}

// Apply to a parsed reply (objects, arrays, nested values). Keys and
// non-string values are left alone. Logs the fields it changed.
export function stripLeakedPhrases(value) {
  var hits = [];
  var out = walk(value, "", "", hits);
  if (hits.length > 0) console.warn("Removed leaked prompt wording from the model reply", { fields: hits });
  return out;
}
