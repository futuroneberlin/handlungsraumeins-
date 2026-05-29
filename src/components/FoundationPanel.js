import { createElement } from "react";
import { SemanticNodeCard } from "./SemanticNodeCard.js";
import { SemanticInspector } from "./SemanticInspector.js";

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
    selectedInspector ? createElement(SemanticInspector, {
      title: selectedInspector.title,
      type: selectedInspector.type,
      summary: selectedInspector.summary,
      activatedDimensions: selectedInspector.activatedDimensions,
      transformationLogic: selectedInspector.transformationLogic,
      relations: selectedInspector.relations,
    }) : null,
    entries.length ? entries.map((entry) => createElement(SemanticNodeCard, {
      key: entry.id || `${entry.conceptName}-${entry.mapping || entry.explanation}`,
      title: entry.conceptName,
      text: entry.explanation,
      meta: [entry.activatedDimensions?.length ? entry.activatedDimensions.join(" · ") : null, entry.transformationLogic || entry.mapping].filter(Boolean).join(" · ") || undefined,
      nodeId: entry.nodeId || null,
      onClick: onNodeSelect,
      children: entry.linkedFragments?.length ? createElement("small", null, `Verbunden mit Fragmenten: ${entry.linkedFragments.slice(0, 4).join(" · ")}`) : null,
    })) : createElement(SemanticNodeCard, {
      title: "Waiting for emergence",
      text: "Stabilisierungen erscheinen, sobald semantische Verdichtung und Theorie-Resonanz ein tragfähiges Interpretationsfeld bilden.",
      meta: "kuratorische Auswertung aktiv",
    }),
  );
}
