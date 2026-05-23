import { createElement } from "react";
import { SemanticInspector } from "./SemanticInspector.js";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

export function FoundationPanel({ categories = [], selectedInspector = null, onNodeSelect, nodeCount = 0, edgeCount = 0 }) {
  return createElement(
    "div",
    { className: "zone-panel", "aria-live": "polite" },
    createElement(
      "div",
      { className: "zone-meta" },
      createElement("span", null, `nodes ${nodeCount}`),
      createElement("span", null, `edges ${edgeCount}`),
    ),
    selectedInspector ? createElement(SemanticInspector, selectedInspector) : null,
    ...(
      categories.length
        ? categories.map((category) => createElement(
          SemanticNodeCard,
          {
            key: category.id,
            title: String(category.label || category.id || "CATEGORY").toUpperCase(),
            text: category.stable ? "stable cluster" : "emergent cluster",
            meta: `${category.nodeCount || 0} nodes · density ${String(category.density ?? 0)}`,
            nodeId: category.nodeIds?.[0] || null,
            onClick: onNodeSelect,
          },
          category.keywords?.length ? createElement("small", null, `signals: ${category.keywords.slice(0, 3).join(" · ")}`) : null,
        ))
        : [createElement(SemanticNodeCard, {
          key: "waiting",
          title: "Waiting for emergence",
          text: "Categories form only after sufficient density.",
          meta: "center simulation active",
        })]
    ),
  );
}
