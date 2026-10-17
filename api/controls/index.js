// Registry of verified control ID lists, keyed by the framework name used in
// the dropdown (api/_prompts.js FRAMEWORKS). A framework that is not here has
// no list, and validateControls flags its whole result instead.
//
// Each entry is { frameworkId, listStatus, controls: [{ id, ... }] }.
// listStatus "draft" means the IDs have not been checked against the standard.

import { SOC2_GROUNDED_DEFINITIONS } from "../_prompts.js";
import iso27001 from "./iso-27001-2022.js";

// SOC 2 reuses the existing verified criteria list, read-only: the keys of
// SOC2_GROUNDED_DEFINITIONS. Nothing in the SOC 2 path changes.
var soc2 = {
  frameworkId: "SOC 2",
  listStatus: "verified",
  controls: Object.keys(SOC2_GROUNDED_DEFINITIONS).map(function(id) { return { id: id }; })
};

export const CONTROL_LISTS = {
  "ISO 27001:2022": iso27001,
  "SOC 2 Type I": soc2,
  "SOC 2 Type II": soc2
};
