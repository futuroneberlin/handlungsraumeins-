import { createElement, useEffect, useMemo } from "react";
import { AppLayout } from "./components/AppLayout.js";
import { GraphCanvas } from "./components/GraphCanvas.js";
import { IngestionPanel } from "./components/IngestionPanel.js";
import { TheoryPanel } from "./components/TheoryPanel.js";
import { FoundationPanel } from "./components/FoundationPanel.js";
import { createGraphActions, graphStore } from "./graph/runtime.js";
import { useGraphVersion } from "./graph/graphState.js";
import { getSelectedNodeDetails } from "./graph/semanticResolver.js";

export function App() {
  useGraphVersion(graphStore);
  const state = graphStore.getState();
  const actions = useMemo(() => createGraphActions(graphStore), []);

  useEffect(() => {
    let active = true;
    actions.bootstrap().catch(() => {
      if (!active) {
        return;
      }
    });

    return () => {
      active = false;
    };
  }, [actions]);

  const inspector = getSelectedNodeDetails(state);
  const left = createElement(IngestionPanel, {
    queue: state.ingestionQueue,
    feedLines: state.feedLines,
    selectedNodeId: state.selectedNode,
    onNodeSelect: (nodeId) => actions.selectNode(nodeId, true),
  });
  const center = createElement(
    "div",
    { className: "stage-shell" },
    createElement(GraphCanvas, { store: graphStore, onNodeSelect: (node) => actions.selectNode(node.id, true) }),
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
    createElement(FoundationPanel, {
      categories: state.categories,
      selectedInspector: inspector,
      onNodeSelect: (nodeId) => actions.selectNode(nodeId, true),
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length,
    }),
  );

  return createElement(AppLayout, { left, center, right });
}
