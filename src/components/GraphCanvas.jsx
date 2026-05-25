import { useEffect, useMemo, useRef } from "react";
import { createGraphActions } from "../graph/runtime.js";
import { useGraphVersion, graphStore } from "../graph/graphState.js";
import { SemanticNodeCard } from "./SemanticNodeCard.jsx";

function pickNodeAt(state, rect, x, y) {
  const relX = x - rect.left;
  const relY = y - rect.top;
  let bestNode = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of state.nodes || []) {
    const radius = Math.max(16, (node.layoutWidth || 220) * 0.22);
    const distance = Math.hypot(relX - node.x, relY - node.y);
    if (distance <= radius && distance < bestDistance) {
      bestNode = node;
      bestDistance = distance;
    }
  }

  return bestNode;
}

export function GraphCanvas({ store, onNodeSelect }) {
  const effectiveStore = store || graphStore;
  useGraphVersion(effectiveStore);
  const state = effectiveStore.getState();
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  const actions = useMemo(() => createGraphActions(effectiveStore), [effectiveStore]);

  useEffect(() => {
    let active = true;
    let frameId = 0;

    const resize = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewport = { width: Math.max(320, Math.floor(rect.width)), height: Math.max(240, Math.floor(rect.height)), dpr: window.devicePixelRatio || 1 };
      actions.setViewport(viewport);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const handleClick = (event) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const node = pickNodeAt(effectiveStore.getState(), rect, event.clientX, event.clientY);
      if (node) {
        onNodeSelectRef.current?.(node);
      }
    };

    const el = containerRef.current;
    el?.addEventListener("click", handleClick);

    const tick = (now) => {
      if (!active) return;
      try {
        actions.tick(now);
      } catch (e) {
        console.error("Tick error:", e);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      el?.removeEventListener("click", handleClick);
    };
  }, [actions, store]);

  // Render: SVG edge layer + node layer (DOM)
  const edges = (state.edges || []).slice(0, 600);

  return (
    <div className="graph-center" ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} className="edge-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width="100%" height="100%">
        {edges.map((edge) => {
          const left = state.nodes.find((n) => n.id === (edge.source ?? edge.leftId)) || state.nodes[edge.leftIndex || -1];
          const right = state.nodes.find((n) => n.id === (edge.target ?? edge.rightId)) || state.nodes[edge.rightIndex || -1];
          if (!left || !right) return null;
          const alpha = Math.min(0.85, Math.max(0.12, (edge.opacity ?? 0.36)));
          const strokeWidth = Math.max(0.6, 0.9 + (edge.score || edge.weight || 0) * 0.28);
          const stroke = edge.type === "wiki" || edge.type === "theory" ? "#c9a227" : edge.type === "category" ? "#ffffff" : "#ffffff";
          return (
            <line key={edge.id || `${edge.source}-${edge.target}`} x1={left.x} y1={left.y} x2={right.x} y2={right.y} stroke={stroke} strokeOpacity={alpha} strokeWidth={strokeWidth} />
          );
        })}
      </svg>

      <div className="node-layer" style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
        {(state.nodes || []).map((node) => (
          <div key={node.id} style={{ position: "absolute", left: `${node.x}px`, top: `${node.y}px`, transform: "translate(-50%, -50%)", width: Math.max(80, node.layoutWidth || 220), pointerEvents: "auto" }}>
            <SemanticNodeCard title={node.text} text={node.wikiSummary || ""} nodeId={node.id} onClick={() => onNodeSelectRef.current?.(node)} />
          </div>
        ))}
      </div>
    </div>
  );
}
