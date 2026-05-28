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
        text: clampSentences(item.excerpt || item.text || item.rawText || "", 3),
        meta: [item.sourceMeta || item.source || "Wikipedia live API", item.stage ? `stage ${item.stage}` : null].filter(Boolean).join(" · ") || "Wikipedia live API",
        nodeId: item.nodeId || item.id || null,
      })),
    ...feedLines
      .filter((line) => Number(line.theoryRelevance || 0) >= 1.12)
      .slice(-3)
      .map((line) => ({
        title: line.title || line.concept || "Wikipedia stream",
        text: clampSentences(line.excerpt || line.text || "", 3),
        meta: [line.sourceMeta || line.source || "Wikipedia live API", line.stage ? `stage ${line.stage}` : "active"].filter(Boolean).join(" · "),
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
      createElement(
        "div",
        { className: "zone-meta" },
        createElement("span", null, `queue ${queue.length}`),
        createElement("span", null, `selected ${selectedNodeId || "none"}`),
      ),
      ...(activeItems.length ? activeItems.map((item, index) => createElement(SemanticNodeCard, {
        key: `${item.title}-${index}`,
        title: item.title,
        text: item.text,
        meta: item.meta,
        nodeId: item.nodeId,
        onClick: onNodeSelect,
      })) : [createElement(SemanticNodeCard, {
        key: "curation-waiting",
        title: "Wikipedia live queue",
        text: "Echte Wikipedia-Artikel erscheinen nur, wenn sie thematisch passen und eine lesbare theoretische Resonanz erzeugen.",
        meta: "staged live ingestion aktiv",
      })]),
    ),
  );
}
