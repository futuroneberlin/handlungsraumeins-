import { createElement } from "react";

export function IngestionPanel() {
  return createElement(
    "aside",
    { className: "ingestion zone", "aria-label": "Wikipedia Ingestion" },
    createElement(
      "div",
      { className: "zone-header" },
      createElement("p", { className: "eyebrow" }, "Left"),
      createElement("h1", null, "Wikipedia / Internet Ingestion"),
    ),
    createElement("div", { id: "ingestion-panel", className: "zone-panel", "aria-live": "polite" }),
  );
}
