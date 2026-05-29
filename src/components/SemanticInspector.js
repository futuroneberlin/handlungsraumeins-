import { createElement } from "react";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

export function SemanticInspector({ title, type, summary, activatedDimensions = [], transformationLogic = "", relations = [] }) {
  const dimensionText = activatedDimensions.length ? activatedDimensions.join(" · ") : "participation · temporality · embodiment · spatial practice";
  return createElement(
    "article",
    { className: "zone-card theory-details" },
    title ? createElement("strong", null, title) : null,
    type ? createElement("span", null, type) : null,
    createElement("small", null, summary || "No summary available yet."),
    createElement("small", null, `Activated dimensions: ${dimensionText}`),
    createElement("small", null, transformationLogic || "Transformation logic not yet stabilized."),
    relations.length ? createElement(
      "div",
      { className: "theory-details" },
      ...relations.map((relation, index) => createElement(SemanticNodeCard, {
        key: relation.id || `${relation.title || relation.label}-${index}`,
        className: "theory-details",
        title: relation.title || relation.label,
        text: relation.interpretation || relation.explanation || "Theory resonance is stabilizing.",
        meta: relation.activatedDimensions?.length
          ? `dimensions ${relation.activatedDimensions.join(" · ")}`
          : relation.transformationLogic || relation.evidence?.length
            ? `logic ${relation.transformationLogic || relation.evidence.join(" · ")}`
            : undefined,
      })),
    ) : null,
  );
}
