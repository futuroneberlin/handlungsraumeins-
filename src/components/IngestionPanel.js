import { createElement } from "react";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

export function IngestionPanel({ queue = [], feedLines = [], selectedNodeId, onNodeSelect, className = "", style, ...rest }) {
  const activeItems = [
    ...queue.slice(0, 6).map((item) => ({
      title: item.source || "Ingestion",
      text: item.text || item.rawText || "",
      meta: `${(item.categories || item.wikiCategories || []).length} categories · ${(item.links || item.wikiLinks || []).length} links`,
      nodeId: item.nodeId || item.id || null,
    })),
    ...feedLines.slice(-4).map((line) => ({
      title: line.source || "Stream",
      text: line.text || "",
      meta: "processed ingestion",
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
