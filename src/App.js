import { createElement, useEffect, useMemo } from "react";
import { AppLayout } from "./components/AppLayout.js";
import { GraphCanvas } from "./components/GraphCanvas.js";
import { IngestionPanel } from "./components/IngestionPanel.js";
import { TheoryPanel } from "./components/TheoryPanel.js";
import { FoundationPanel } from "./components/FoundationPanel.js";
import { createGraphActions, graphStore } from "./graph/runtime.js";
import { useGraphVersion } from "./graph/graphState.js";
import { getTheorySynthesis, getTheoryStabilizationEntries } from "./graph/semanticResolver.js";

const DEBUG_NODE_PREFIX = "debug-";

function isDebugId(value) {
  return String(value || "").startsWith(DEBUG_NODE_PREFIX);
}

export function App() {
  useGraphVersion(graphStore);
  const state = graphStore.getState();
  const actions = useMemo(() => createGraphActions(graphStore), []);

  useEffect(() => {
    let active = true;
    actions.bootstrap().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [actions]);

  useEffect(() => {
    if (state.nodes.length) {
      return;
    }

    graphStore.update((draft) => {
      if (draft.nodes.length) {
        return;
      }

      draft.nodes = [
        {
          id: "debug-ingestion-node",
          text: "Wikipedia / Internet Ingestion",
          wikiSummary: "Temporary test node to confirm the left panel and graph canvas stay visible.",
          x: 240,
          y: 260,
          layoutWidth: 260,
          keyword: "Ingestion",
          semanticGroup: "Debug",
          category: "Debug",
        },
        {
          id: "debug-graph-node",
          text: "Semantic Spatial Graph",
          wikiSummary: "Temporary test node to confirm the center graph renders independently.",
          x: 540,
          y: 240,
          layoutWidth: 260,
          keyword: "Graph",
          semanticGroup: "Debug",
          category: "Debug",
        },
        {
          id: "debug-theory-node",
          text: "Theory Panel",
          wikiSummary: "Temporary test node to confirm the right panel remains visible.",
          x: 860,
          y: 260,
          layoutWidth: 260,
          keyword: "Theory",
          semanticGroup: "Debug",
          category: "Debug",
        },
      ];

      draft.edges = [
        {
          id: "debug-edge-left-center",
          source: "debug-ingestion-node",
          target: "debug-graph-node",
          leftIndex: 0,
          rightIndex: 1,
          opacity: 0.32,
          weight: 1,
          score: 1,
          type: "semantic",
        },
        {
          id: "debug-edge-center-right",
          source: "debug-graph-node",
          target: "debug-theory-node",
          leftIndex: 1,
          rightIndex: 2,
          opacity: 0.32,
          weight: 1,
          score: 1,
          type: "semantic",
        },
      ];

      if (!draft.selectedNode) {
        draft.selectedNode = "debug-graph-node";
      }
    });
  }, [state.nodes.length]);

  useEffect(() => {
    const hasRealNodes = state.nodes.some((node) => !isDebugId(node.id));
    const hasDebugNodes = state.nodes.some((node) => isDebugId(node.id));

    if (!hasRealNodes || !hasDebugNodes) {
      return;
    }

    graphStore.update((draft) => {
      draft.nodes = draft.nodes.filter((node) => !isDebugId(node.id));
      draft.edges = draft.edges.filter((edge) => !isDebugId(edge.id));

      if (isDebugId(draft.selectedNode)) {
        draft.selectedNode = draft.nodes[0]?.id || null;
      }
    });
  }, [state.nodes.length, state.corpus.length]);

  const ingestionQueue = state.ingestionQueue.length ? state.ingestionQueue : [
    {
      id: "debug-ingestion-1",
      nodeId: "debug-ingestion-node",
      title: "Semantic Ingestion",
      source: "Debug feed",
      text: "Concise semantic fragment for the left panel.",
      excerpt: "Concise semantic fragment for the left panel.",
      rawText: "Concise semantic fragment for the left panel.",
      keywords: ["concept", "fragment", "ingestion"],
      categories: ["Debug"],
      links: [],
      wikiCategories: ["Debug"],
      wikiLinks: [],
    },
    {
      id: "debug-ingestion-2",
      nodeId: "debug-graph-node",
      title: "Conceptual Resonance",
      source: "Debug feed",
      text: "Participation and temporality as fragmentary material.",
      excerpt: "Participation and temporality as fragmentary material.",
      rawText: "Participation and temporality as fragmentary material.",
      keywords: ["participation", "temporality", "relation"],
      categories: ["Debug"],
      links: [],
      wikiCategories: ["Debug"],
      wikiLinks: [],
    },
  ];

  const feedLines = state.feedLines.length ? state.feedLines : [
    {
      id: "debug-feed-1",
      title: "Debug Stream",
      source: "Debug stream",
      text: "Visibility check as abstract fragment.",
      excerpt: "Visibility check as abstract fragment.",
      keywords: ["fragment", "visibility"],
      opacity: 0.92,
      y: 0,
    },
  ];

  const debugNodes = state.nodes.length ? null : [
    {
      id: "debug-graph-node",
      text: "Semantic Spatial Graph",
      semanticLabel: "Semantic Spatial Graph",
      semanticExcerpt: "Concept abstraction prototype.",
      wikiSummary: "Concept abstraction prototype.",
      concepts: ["participation", "interaction", "transformation"],
      x: 540,
      y: 240,
      layoutWidth: 260,
    },
  ];

  const debugEdges = state.nodes.length ? null : [
    {
      id: "debug-graph-edge",
      source: "debug-graph-node",
      target: "debug-graph-node",
      leftIndex: 0,
      rightIndex: 0,
      opacity: 0.18,
      weight: 1,
      score: 1,
      type: "semantic",
    },
  ];
  const theorySynthesis = getTheorySynthesis(state);
  const theoryStabilizations = getTheoryStabilizationEntries(state);

  return createElement(AppLayout, {
    left: createElement(IngestionPanel, {
      queue: ingestionQueue,
      feedLines,
      selectedNodeId: state.selectedNode,
      onNodeSelect: (nodeId) => actions.selectNode(nodeId, false),
    }),
    center: createElement(
      "div",
      { className: "stage-shell" },
      createElement(GraphCanvas, {
        store: graphStore,
        debugNodes,
        debugEdges,
        onNodeSelect: (node) => actions.selectNode(node.id, false),
      }),
    ),
    right: createElement(
      "aside",
      { className: "fundament zone", "aria-label": "Theoretical Stabilization and Interpretation" },
      createElement(
        "div",
        { className: "zone-header" },
        createElement("p", { className: "eyebrow" }, "Right"),
        createElement("h1", null, "Theoretical Stabilization / Interpretation"),
      ),
      createElement(TheoryPanel, { synthesizedStatements: theorySynthesis }),
      createElement(FoundationPanel, {
        categories: state.categories,
        stabilizations: theoryStabilizations,
        selectedInspector: null,
        onNodeSelect: undefined,
        nodeCount: state.nodes.length,
        edgeCount: state.edges.length,
      }),
    ),
  });
}
