import { createElement } from "react";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

export function FoundationPanel({ categories = [], stabilizations = [], selectedInspector = null, onNodeSelect, nodeCount = 0, edgeCount = 0, className = "", style, ...rest }) {
  const entries = Array.isArray(stabilizations) && stabilizations.length
    ? stabilizations
    : categories.map((category) => ({
      id: category.id,
      conceptName: String(category.label || category.id || "CATEGORY"),
      explanation: category.synopsis || (category.stable ? "stable cluster" : "emergent cluster"),
      linkedFragments: category.concepts?.slice(0, 3) || category.keywords?.slice(0, 3) || [],
      mapping: "Mapped to Actional Space: conceptual stabilization through transformation and relation.",
      nodeId: category.nodeIds?.[0] || null,
      density: category.density,
      nodeCount: category.nodeCount,
    }));

  return createElement(
    "div",
    { className: `zone-panel ${className}`.trim(), "aria-live": "polite", style, ...rest },
    createElement(
      "div",
      { className: "zone-meta" },
      createElement("span", null, `nodes ${nodeCount}`),
      createElement("span", null, `edges ${edgeCount}`),
    ),
    entries.length ? entries.map((entry) => createElement(SemanticNodeCard, {
      key: entry.id,
      title: entry.conceptName,
      text: entry.explanation,
      meta: `${entry.mapping}${entry.nodeCount ? ` · ${entry.nodeCount} nodes` : ""}${Number.isFinite(entry.density) ? ` · density ${String(entry.density)}` : ""}`,
      nodeId: entry.nodeId || null,
      onClick: onNodeSelect,
      children: entry.linkedFragments?.length ? createElement("small", null, `linked fragments: ${entry.linkedFragments.slice(0, 3).join(" · ")}`) : null,
    })) : createElement(SemanticNodeCard, {
      title: "Waiting for emergence",
      text: "Categories form only after sufficient density.",
      meta: "center simulation active",
    }),
  );
}
