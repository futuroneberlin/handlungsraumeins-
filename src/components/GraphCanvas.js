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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  const renderNodes = hasRealNodes ? [...(state.nodes || [])].sort((left, right) => (left.z || 0) - (right.z || 0)) : (debugNodes || []);
  const renderEdges = hasRealNodes ? (state.edges || []).slice(0, 600) : (debugEdges || []);

  return createElement(
    "div",
    { className: `graph-center ${className}`.trim(), ref: containerRef, style: { position: "relative", width: "100%", height: "100%", ...style }, ...rest },
    createElement(
      "svg",
      { ref: svgRef, className: "edge-layer", style: { position: "absolute", inset: 0, pointerEvents: "none" }, width: "100%", height: "100%" },
      createElement(
        "defs",
        null,
        createElement(
          "filter",
          { id: "relation-soft-glow", x: "-20%", y: "-20%", width: "140%", height: "140%" },
          createElement("feGaussianBlur", { stdDeviation: "1.1", result: "blur" }),
          createElement("feColorMatrix", { in: "blur", type: "matrix", values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0" }),
        ),
      ),
      ...renderEdges.map((edge) => {
        const left = renderNodes.find((n) => n.id === (edge.source ?? edge.leftId)) || renderNodes[edge.leftIndex || -1];
        const right = renderNodes.find((n) => n.id === (edge.target ?? edge.rightId)) || renderNodes[edge.rightIndex || -1];
        if (!left || !right) return null;
        const semanticStrength = edge.semanticStrength ?? edge.score ?? edge.weight ?? 0;
        const leftZ = left.z ?? 1;
        const rightZ = right.z ?? 1;
        const depthSpan = Math.abs(leftZ - rightZ);
        const midpointX = (left.x + right.x) * 0.5;
        const midpointY = (left.y + right.y) * 0.5;
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / distance;
        const ny = dx / distance;
        const tension = clamp(0.06 + semanticStrength * 0.09 + depthSpan * 0.05 + Math.min(0.22, (edge.confidence || 0) * 0.14), 0.05, 0.42);
        const curveX = midpointX + nx * distance * tension;
        const curveY = midpointY + ny * distance * tension * 0.72;
        const d = `M ${left.x} ${left.y} Q ${curveX} ${curveY} ${right.x} ${right.y}`;
        const alpha = Math.min(0.9, Math.max(0.04, (edge.opacity ?? 0.08) + Math.min(0.45, semanticStrength * 0.17) + Math.min(0.24, (edge.confidence || 0) * 0.24)));
        const strokeWidth = Math.max(0.5, 0.68 + semanticStrength * 0.38 + Math.min(0.52, (edge.confidence || 0) * 0.38));
        const blur = clamp(1.5 - semanticStrength * 0.52, 0.12, 1.45);
        const stroke = edge.type === "wiki" || edge.type === "theory" ? "#c9a227" : edge.type === "category" ? "#ffffff" : "#ffffff";
        return createElement("path", {
          key: edge.id || `${edge.source}-${edge.target}`,
          d,
          stroke,
          strokeOpacity: alpha,
          strokeWidth,
          fill: "none",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          filter: `url(#relation-soft-glow)`,
          style: { filter: `blur(${blur}px)` },
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
          style: {
            position: "absolute",
            left: `${node.x}px`,
            top: `${node.y}px`,
            transform: `translate(-50%, -50%) scale(${clamp(0.82 + (node.z ?? 1) * 0.18 + (node.semanticDensity || 0) * 0.05, 0.76, 1.18)})`,
            width: Math.max(80, node.layoutWidth || 220),
            pointerEvents: "auto",
            opacity: clamp((node.atmosphericOpacity ?? node.opacity ?? 1), 0.2, 1),
            filter: `blur(${clamp(node.depthBlur ?? 0.12, 0.02, 0.42)}px) saturate(${clamp(0.92 + (node.z ?? 1) * 0.08, 0.92, 1.12)})`,
          },
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