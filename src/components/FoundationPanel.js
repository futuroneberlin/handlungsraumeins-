import { createElement } from "react";
import { SemanticInspector } from "./SemanticInspector.js";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

export function FoundationPanel({ categories = [], selectedInspector = null, onNodeSelect, nodeCount = 0, edgeCount = 0, className = "", style, ...rest }) {
  return createElement(
    "div",
    { className: `zone-panel ${className}`.trim(), "aria-live": "polite", style, ...rest },
    createElement(
      "div",
      { className: "zone-meta" },
      createElement("span", null, `nodes ${nodeCount}`),
      createElement("span", null, `edges ${edgeCount}`),
    ),
    selectedInspector ? createElement(SemanticInspector, selectedInspector) : null,
    categories.length ? categories.map((category) => createElement(SemanticNodeCard, {
      key: category.id,
      title: String(category.label || category.id || "CATEGORY"),
      text: category.synopsis || (category.stable ? "stable cluster" : "emergent cluster"),
      meta: `${category.nodeCount || 0} nodes · density ${String(category.density ?? 0)}`,
      nodeId: category.nodeIds?.[0] || null,
      onClick: onNodeSelect,
      children: category.concepts?.length ? createElement("small", null, `concepts: ${category.concepts.slice(0, 3).join(" · ")}`) : category.keywords?.length ? createElement("small", null, `signals: ${category.keywords.slice(0, 3).join(" · ")}`) : null,
    })) : createElement(SemanticNodeCard, {
      title: "Waiting for emergence",
      text: "Categories form only after sufficient density.",
      meta: "center simulation active",
    }),
  );
}
