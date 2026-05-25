import { createElement, useEffect, useMemo } from "react";
import { AppLayout } from "./components/AppLayout.js";
import { GraphCanvas } from "./components/GraphCanvas.jsx";
import { IngestionPanel } from "./components/IngestionPanel.js";
import { TheoryPanel } from "./components/TheoryPanel.js";
import { FoundationPanel } from "./components/FoundationPanel.js";
import { createGraphActions, graphStore } from "./graph/runtime.js";

export function App() {
  useEffect(() => {
    const actions = createGraphActions(graphStore);
    let active = true;
    actions.bootstrap().catch(() => {
      if (!active) return;
    });
    return () => { active = false; };
  }, []);

  const left = createElement(IngestionPanel, null);
  const center = createElement(
    "div",
    { className: "stage-shell" },
    createElement(GraphCanvas, null),
  );
  const right = createElement(
    "aside",
    { className: "fundament zone", "aria-label": "Emergent Categories" },
    createElement(
      "div",
      { className: "zone-header" },
      createElement("p", { className: "eyebrow" }, "Right"),
      createElement("h1", null, "Emergent Categories / Foundation"),
    ),
    createElement(TheoryPanel, null),
    createElement(FoundationPanel, null),
  );

  return createElement(AppLayout, { left, center, right });
}
