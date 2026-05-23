import { SemanticNodeCard } from "./SemanticNodeCard.jsx";

export function IngestionPanel({ queue = [], feedLines = [], selectedNodeId, onNodeSelect }) {
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

  return (
    <aside className="ingestion zone" aria-label="Wikipedia Ingestion">
      <div className="zone-header">
        <p className="eyebrow">Left</p>
        <h1>Wikipedia / Internet Ingestion</h1>
      </div>
      <div className="zone-panel" aria-live="polite">
        <div className="zone-meta">
          <span>queue {queue.length}</span>
          <span>selected {selectedNodeId || "none"}</span>
        </div>
        {activeItems.map((item, index) => (
          <SemanticNodeCard
            key={`${item.title}-${index}`}
            title={item.title}
            text={item.text}
            meta={item.meta}
            nodeId={item.nodeId}
            onClick={onNodeSelect}
          />
        ))}
      </div>
    </aside>
  );
}
