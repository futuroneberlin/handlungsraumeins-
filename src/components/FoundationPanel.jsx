import { SemanticInspector } from "./SemanticInspector.jsx";
import { SemanticNodeCard } from "./SemanticNodeCard.jsx";

export function FoundationPanel({ categories = [], selectedInspector = null, onNodeSelect, nodeCount = 0, edgeCount = 0 }) {
  return (
    <div className="zone-panel" aria-live="polite">
      <div className="zone-meta">
        <span>nodes {nodeCount}</span>
        <span>edges {edgeCount}</span>
      </div>
      {selectedInspector ? <SemanticInspector {...selectedInspector} /> : null}
      {categories.length ? (
        categories.map((category) => (
          <SemanticNodeCard
            key={category.id}
            title={String(category.label || category.id || "CATEGORY").toUpperCase()}
            text={category.stable ? "stable cluster" : "emergent cluster"}
            meta={`${category.nodeCount || 0} nodes · density ${String(category.density ?? 0)}`}
            nodeId={category.nodeIds?.[0] || null}
            onClick={onNodeSelect}
          >
            {category.keywords?.length ? <small>signals: {category.keywords.slice(0, 3).join(" · ")}</small> : null}
          </SemanticNodeCard>
        ))
      ) : (
        <SemanticNodeCard title="Waiting for emergence" text="Categories form only after sufficient density." meta="center simulation active" />
      )}
    </div>
  );
}
