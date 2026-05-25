import { createElement, useEffect, useMemo, useRef } from "react";
import { createGraphActions } from "../graph/runtime.js";
import { useGraphVersion, graphStore } from "../graph/graphState.js";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

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

export function GraphCanvas({ store, onNodeSelect, debugNodes = null, debugEdges = null, className = "", style, ...rest }) {
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

  const hasRealNodes = (state.nodes || []).length > 0;
  const renderNodes = hasRealNodes ? state.nodes || [] : (debugNodes || []);
  const renderEdges = hasRealNodes ? (state.edges || []).slice(0, 600) : (debugEdges || []);

  return createElement(
    "div",
    { className: `graph-center ${className}`.trim(), ref: containerRef, style: { position: "relative", width: "100%", height: "100%", ...style }, ...rest },
    createElement(
      "svg",
      { ref: svgRef, className: "edge-layer", style: { position: "absolute", inset: 0, pointerEvents: "none" }, width: "100%", height: "100%" },
      ...renderEdges.map((edge) => {
        const left = renderNodes.find((n) => n.id === (edge.source ?? edge.leftId)) || renderNodes[edge.leftIndex || -1];
        const right = renderNodes.find((n) => n.id === (edge.target ?? edge.rightId)) || renderNodes[edge.rightIndex || -1];
        if (!left || !right) return null;
        const alpha = Math.min(0.85, Math.max(0.12, (edge.opacity ?? 0.36)));
        const strokeWidth = Math.max(0.6, 0.9 + (edge.score || edge.weight || 0) * 0.28);
        const stroke = edge.type === "wiki" || edge.type === "theory" ? "#c9a227" : edge.type === "category" ? "#ffffff" : "#ffffff";
        return createElement("line", {
          key: edge.id || `${edge.source}-${edge.target}`,
          x1: left.x,
          y1: left.y,
          x2: right.x,
          y2: right.y,
          stroke,
          strokeOpacity: alpha,
          strokeWidth,
        });
      }).filter(Boolean),
    ),
    createElement(
      "div",
      { className: "node-layer", style: { position: "absolute", inset: 0, pointerEvents: "auto" } },
      ...renderNodes.map((node) => createElement(
        "div",
        {
          key: node.id,
          style: { position: "absolute", left: `${node.x}px`, top: `${node.y}px`, transform: "translate(-50%, -50%)", width: Math.max(80, node.layoutWidth || 220), pointerEvents: "auto" },
        },
        createElement(SemanticNodeCard, {
          title: node.semanticLabel || node.title || node.text,
          text: node.semanticExcerpt || node.wikiSummary || "",
          meta: (node.concepts || node.keywords || []).slice(0, 4).join(" · "),
          nodeId: node.id,
          onClick: () => onNodeSelectRef.current?.(node),
        }),
      )),
    ),
  );
}