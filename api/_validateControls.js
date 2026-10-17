// Checks the control IDs a model returned against a verified list.
//
// Pure: no UI, no API call, no network. It never edits or drops a control; it
// only reports. IDs are compared exactly (surrounding whitespace is ignored),
// so "a.5.3" and "A.5.3." do not match "A.5.3".

import { CONTROL_LISTS } from "./controls/index.js";

export const NO_LIST_BANNER = "AI-generated, verify control IDs before use.";

// Sets of valid IDs, built once per list.
var idSets = new Map();

function idSetFor(list) {
  if (!idSets.has(list)) {
    idSets.set(list, new Set(list.controls.map(function(c) { return c.id; })));
  }
  return idSets.get(list);
}

// validateControls(frameworkId, controls) returns:
//   { frameworkId, hasList, listStatus, banner, controls: [{ id, status }] }
// With a list: status is "listed" or "unverified", banner is null, and
// listStatus is the list's own ("draft" or "verified").
// Without a list (or for an unknown framework): hasList is false, listStatus
// is null, banner is NO_LIST_BANNER, and each status is "unchecked".
export function validateControls(frameworkId, controls) {
  var list = Object.prototype.hasOwnProperty.call(CONTROL_LISTS, frameworkId) ? CONTROL_LISTS[frameworkId] : null;
  var items = Array.isArray(controls) ? controls : [];

  if (!list) {
    return {
      frameworkId: frameworkId,
      hasList: false,
      listStatus: null,
      banner: NO_LIST_BANNER,
      controls: items.map(function(c) { return { id: idOf(c), status: "unchecked" }; })
    };
  }

  var valid = idSetFor(list);
  return {
    frameworkId: frameworkId,
    hasList: true,
    listStatus: list.listStatus,
    banner: null,
    controls: items.map(function(c) {
      var id = idOf(c);
      return { id: id, status: typeof id === "string" && valid.has(id.trim()) ? "listed" : "unverified" };
    })
  };
}

// The id as the model returned it, or undefined if the entry has none.
function idOf(control) {
  return control !== null && typeof control === "object" ? control.id : undefined;
}
