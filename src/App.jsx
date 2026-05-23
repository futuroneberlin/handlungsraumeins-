import { useEffect, useMemo } from "react";
import { AppLayout } from "./components/AppLayout.jsx";
import { GraphCanvas } from "./components/GraphCanvas.jsx";
import { IngestionPanel } from "./components/IngestionPanel.jsx";
import { TheoryPanel } from "./components/TheoryPanel.jsx";
import { FoundationPanel } from "./components/FoundationPanel.jsx";
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

  return (
    <AppLayout
      left={<IngestionPanel queue={state.ingestionQueue} feedLines={state.feedLines} selectedNodeId={state.selectedNode} onNodeSelect={(nodeId) => actions.selectNode(nodeId, true)} />}
      center={<div className="stage-shell"><GraphCanvas store={graphStore} onNodeSelect={(node) => actions.selectNode(node.id, true)} /></div>}
      right={(
        <aside className="fundament zone" aria-label="Emergent Categories">
          <div className="zone-header">
            <p className="eyebrow">Right</p>
            <h1>Emergent Categories / Foundation</h1>
          </div>
          <TheoryPanel />
          <FoundationPanel categories={state.categories} selectedInspector={inspector} onNodeSelect={(nodeId) => actions.selectNode(nodeId, true)} nodeCount={state.nodes.length} edgeCount={state.edges.length} />
        </aside>
      )}
    />
  );
}
