import { createElement } from "react";

export function FoundationPanel() {
  return createElement("div", { id: "foundation-panel", className: "zone-panel", "aria-live": "polite" });
}
