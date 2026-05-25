import { createElement } from "react";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

export function IngestionPanel({ queue = [], feedLines = [], selectedNodeId, onNodeSelect, className = "", style, ...rest }) {
  const activeItems = [
    ...queue.slice(0, 4).map((item) => ({
      title: item.title || item.concept || item.source || "Ingestion",
      text: item.excerpt || item.text || item.rawText || "",
      meta: [...new Set([...(item.keywords || item.categories || item.wikiCategories || [])].filter(Boolean))].slice(0, 5).join(" · "),
      nodeId: item.nodeId || item.id || null,
    })),
    ...feedLines.slice(-3).map((line) => ({
      title: line.title || line.concept || line.source || "Stream",
      text: line.excerpt || line.text || "",
      meta: [...new Set((line.keywords || []).filter(Boolean))].slice(0, 5).join(" · "),
    })),
  ];

  return createElement(
    "aside",
    { className: `ingestion zone ${className}`.trim(), "aria-label": "Wikipedia Ingestion", style, ...rest },
    createElement(
      "div",
      { className: "zone-header" },
      createElement("p", { className: "eyebrow" }, "Left"),
      createElement("h1", null, "Wikipedia / Internet Ingestion"),
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
      ...activeItems.map((item, index) => createElement(SemanticNodeCard, {
        key: `${item.title}-${index}`,
        title: item.title,
        text: item.text,
        meta: item.meta,
        nodeId: item.nodeId,
        onClick: onNodeSelect,
      })),
    ),
  );
}
