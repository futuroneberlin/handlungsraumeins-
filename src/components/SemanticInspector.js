import { createElement } from "react";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

export function SemanticInspector({ title, type, summary, categories = [], links = [], relations = [] }) {
  return createElement(
    "article",
    { className: "zone-card theory-details" },
    createElement("strong", null, title),
    createElement("span", null, type),
    createElement("small", null, summary || "No summary available yet."),
    categories.length ? createElement("small", null, `Categories: ${categories.slice(0, 4).join(" · ")}`) : null,
    links.length ? createElement("small", null, `Internal links: ${links.slice(0, 4).join(" · ")}`) : null,
    relations.length ? createElement(
      "div",
      { className: "theory-details" },
      ...relations.map((relation) => createElement(SemanticNodeCard, {
        key: `${relation.label}-${relation.explanation}`,
        className: "theory-details",
        title: relation.label,
        text: `${relation.explanation} · confidence ${relation.confidence}%`,
        meta: relation.evidence?.length ? `evidence ${relation.evidence.join(" · ")}` : undefined,
      })),
    ) : null,
  );
}
