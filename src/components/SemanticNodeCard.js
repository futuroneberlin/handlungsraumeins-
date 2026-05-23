import { createElement } from "react";

export function SemanticNodeCard({ title, text, meta, nodeId, className = "", onClick, children }) {
  const clickable = Boolean(nodeId && onClick);
  const content = [];

  if (title) {
    content.push(createElement("strong", { key: "title" }, title));
  }

  if (text) {
    content.push(createElement("span", { key: "text" }, text));
  }

  if (meta) {
    content.push(createElement("small", { key: "meta" }, meta));
  }

  if (children) {
    content.push(children);
  }

  return createElement(
    "article",
    {
      className: `zone-card ${className}`.trim(),
      "data-node-id": nodeId || undefined,
      onClick: clickable ? () => onClick(nodeId) : undefined,
    },
    ...content,
  );
}
