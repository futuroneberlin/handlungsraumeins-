import { createElement } from "react";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

function clampSentences(text, maxSentences = 3) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, maxSentences);
  return sentences.join(" ");
}

export function IngestionPanel({ queue = [], feedLines = [], selectedNodeId, onNodeSelect, className = "", style, ...rest }) {
  const activeItems = [
    ...queue
      .filter((item) => Number(item.theoryRelevance || 0) >= 1.12)
      .slice(0, 4)
      .map((item) => ({
        title: item.title || "Wikipedia article",
        text: clampSentences(item.excerpt || item.text || "", 2),
        concepts: (item.concepts || item.keywords || []).slice(0, 5),
        nodeId: item.nodeId || item.id || null,
      })),
  ].filter((item) => item.text);

  return createElement(
    "aside",
    { className: `ingestion zone ${className}`.trim(), "aria-label": "Semantic Ingestion", style, ...rest },
    createElement(
      "div",
      { className: "zone-header" },
      createElement("p", { className: "eyebrow" }, "Left"),
      createElement("h1", null, "Semantic Ingestion"),
    ),
    createElement(
      "div",
      { className: "zone-panel", "aria-live": "polite" },
      ...(activeItems.length ? activeItems.map((item, index) => createElement(SemanticNodeCard, {
        key: `${item.nodeId || item.title}-${index}`,
        title: item.title,
        text: item.text,
        meta: item.concepts?.length ? item.concepts.join(" · ") : undefined,
        nodeId: item.nodeId,
        onClick: onNodeSelect,
      })) : [createElement(SemanticNodeCard, {
        key: "curation-waiting",
        title: "Wikipedia live queue",
        text: "Kuratiertes Material erscheint langsam, wenn ein Artikel genügend theoretische Resonanz erzeugt.",
        meta: "actional space curation",
      })]),
    ),
  );
}
