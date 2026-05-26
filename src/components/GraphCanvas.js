import { createElement, useEffect, useMemo, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { createGraphActions } from "../graph/runtime.js";
import { useGraphVersion, graphStore } from "../graph/graphState.js";
import { SemanticNodeCard } from "./SemanticNodeCard.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function extractNodeId(node) {
  if (!node) {
    return "";
  }

  if (node.id) {
    return String(node.id);
  }

  if (node.nodeId) {
    return String(node.nodeId);
  }

  const wikiIdentity = node.wikiTitle || node.title || node.semanticLabel || node.keyword || node.text || node.wikiUrl;
  const normalized = normalizeKey(wikiIdentity);
  return normalized;
}

function resolveEndpoint(reference, nodesById, nodesByIndex) {
  if (reference && typeof reference === "object") {
    const objectId = extractNodeId(reference);
    if (objectId && nodesById.has(objectId)) {
      return nodesById.get(objectId);
    }

    if (Number.isInteger(reference.index) && nodesByIndex[reference.index]) {
      return nodesByIndex[reference.index];
    }

    if (Number.isFinite(reference.x) && Number.isFinite(reference.y)) {
      return { ...reference, id: objectId || `inline-${reference.index || 0}` };
    }
  }

  const directId = reference == null ? "" : String(reference);
  if (directId && nodesById.has(directId)) {
    return nodesById.get(directId);
  }

  if (Number.isInteger(reference) && nodesByIndex[reference]) {
    return nodesByIndex[reference];
  }

  return null;
}

function createFeedActivityIndex(state) {
  const activityMap = new Map();
  const lines = state.feedLines || [];

  for (const line of lines) {
    const lineNodeId = String(line.nodeId || "").trim();
    if (lineNodeId) {
      activityMap.set(lineNodeId, (activityMap.get(lineNodeId) || 0) + 1.6);
    }
  }

  const fullFeedText = lines
    .map((line) => `${line.title || ""} ${line.text || ""} ${(line.keywords || []).join(" ")}`.toLowerCase())
    .join(" || ");

  for (const node of state.nodes || []) {
    const nodeId = extractNodeId(node);
    const tokens = [
      node.semanticLabel,
      node.title,
      node.text,
      node.keyword,
      ...(node.concepts || []),
      ...(node.keywords || []),
      ...(node.wikiCategories || []),
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value.length > 3)
      .slice(0, 10);

    let score = activityMap.get(nodeId) || 0;
    for (const token of tokens) {
      if (fullFeedText.includes(token)) {
        score += 0.32;
      }
    }

    activityMap.set(nodeId, score);
  }

  return activityMap;
}

function projectNodeDepth(node, width, height) {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const maxDistance = Math.max(120, Math.hypot(centerX, centerY));
  const distance = Math.hypot((node.x || centerX) - centerX, (node.y || centerY) - centerY);
  const distanceRatio = clamp(distance / maxDistance, 0, 1);
  const depthScale = clamp(1.1 - distanceRatio * 0.32 + (node.z != null ? (1 - node.z) * 0.05 : 0), 0.78, 1.2);

  return {
    depthScale,
    distanceRatio,
  };
}

export function GraphCanvas({ store, onNodeSelect, debugNodes = null, debugEdges = null, className = "", style, ...rest }) {
  const effectiveStore = store || graphStore;
  useGraphVersion(effectiveStore);
  const state = effectiveStore.getState();
  const containerRef = useRef(null);
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
    };
  }, [actions, store]);

  const hasRealNodes = (state.nodes || []).length > 0;
  const baseNodes = hasRealNodes ? (state.nodes || []) : (debugNodes || []);
  const baseEdges = hasRealNodes ? (state.edges || []) : (debugEdges || []);

  const simulation = useMemo(() => {
    const width = Math.max(320, state.viewport?.width || 0 || 960);
    const height = Math.max(240, state.viewport?.height || 0 || 560);
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    const nodes = baseNodes.map((node, index) => {
      const nodeId = extractNodeId(node) || `node-${index}`;
      const fallbackAngle = (index / Math.max(1, baseNodes.length)) * Math.PI * 2;
      const fallbackRadius = Math.min(width, height) * 0.26;
      const x = Number.isFinite(node.x) ? node.x : centerX + Math.cos(fallbackAngle) * fallbackRadius;
      const y = Number.isFinite(node.y) ? node.y : centerY + Math.sin(fallbackAngle) * fallbackRadius;

      return {
        ...node,
        id: nodeId,
        x,
        y,
      };
    });

    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const activityMap = createFeedActivityIndex({ ...state, nodes });

    const links = baseEdges
      .slice(0, 900)
      .map((edge, edgeIndex) => {
        const sourceNode = resolveEndpoint(edge.source ?? edge.leftId ?? edge.sourceId ?? edge.leftIndex, nodesById, nodes);
        const targetNode = resolveEndpoint(edge.target ?? edge.rightId ?? edge.targetId ?? edge.rightIndex, nodesById, nodes);
        if (!sourceNode || !targetNode) {
          return null;
        }

        return {
          ...edge,
          id: edge.id || `edge-${edgeIndex}`,
          source: sourceNode.id,
          target: targetNode.id,
          sourceNode,
          targetNode,
        };
      })
      .filter(Boolean);

    const linkForce = forceLink(links)
      .id((node) => node.id)
      .distance((edge) => {
        const strength = Number(edge.semanticStrength ?? edge.score ?? edge.weight ?? 0);
        return clamp(190 - strength * 34, 88, 260);
      })
      .strength((edge) => {
        const confidence = Number(edge.confidence || edge.semanticStrength || edge.score || edge.weight || 0);
        return clamp(0.08 + confidence * 0.12, 0.06, 0.26);
      });

    const collision = forceCollide()
      .radius((node) => {
        const activity = clamp((activityMap.get(node.id) || 0) / 3.2, 0, 1);
        return Math.max(48, (node.layoutWidth || 220) * (0.28 + activity * 0.08));
      })
      .iterations(2);

    const simulationModel = forceSimulation(nodes)
      .force("center", forceCenter(centerX, centerY))
      .force("link", linkForce)
      .force("charge", forceManyBody().strength((node) => -92 - (node.theoryResonanceScore || 0) * 48 - (node.semanticDensity || 0) * 34))
      .force("collision", collision)
      .stop();

    for (let tick = 0; tick < 24; tick += 1) {
      simulationModel.tick();
    }

    const projectedNodes = nodes
      .map((node) => {
        const activity = clamp((activityMap.get(node.id) || 0) / 3.2, 0, 1);
        const { depthScale, distanceRatio } = projectNodeDepth(node, width, height);
        const baseOpacity = clamp(node.atmosphericOpacity ?? node.opacity ?? 0.82, 0.2, 1);

        return {
          ...node,
          depthScale,
          distanceRatio,
          semanticActivity: activity,
          renderOpacity: clamp(baseOpacity * (0.46 + activity * 0.54), 0.22, 1),
        };
      })
      .sort((left, right) => right.distanceRatio - left.distanceRatio);

    const projectedById = new Map(projectedNodes.map((node) => [node.id, node]));
    const projectedLinks = links
      .map((edge) => {
        const sourceNode = projectedById.get(extractNodeId(edge.sourceNode) || String(edge.source || "")) || projectedById.get(String(edge.source));
        const targetNode = projectedById.get(extractNodeId(edge.targetNode) || String(edge.target || "")) || projectedById.get(String(edge.target));

        if (!sourceNode || !targetNode) {
          return null;
        }

        return {
          ...edge,
          sourceNode,
          targetNode,
        };
      })
      .filter(Boolean);

    return {
      nodes: projectedNodes,
      edges: projectedLinks,
      width,
      height,
    };
  }, [baseEdges, baseNodes, state.feedLines, state.viewport?.height, state.viewport?.width, state.nodes]);

  const renderNodes = simulation.nodes;
  const renderEdges = simulation.edges;
  const viewWidth = simulation.width;
  const viewHeight = simulation.height;

  return createElement(
    "div",
    { className: `graph-center ${className}`.trim(), ref: containerRef, style: { position: "relative", width: "100%", height: "100%", ...style }, ...rest },
    createElement(
      "svg",
      { className: "edge-layer", style: { position: "absolute", inset: 0, pointerEvents: "auto" }, width: "100%", height: "100%", viewBox: `0 0 ${viewWidth} ${viewHeight}` },
      createElement(
        "defs",
        null,
        createElement(
          "marker",
          {
            id: "relation-arrow",
            markerWidth: "8",
            markerHeight: "8",
            refX: "7",
            refY: "3.5",
            orient: "auto",
            markerUnits: "strokeWidth",
          },
          createElement("path", { d: "M0,0 L0,7 L7,3.5 z", fill: "#ffffff", fillOpacity: "0.78" }),
        ),
        createElement(
          "filter",
          { id: "relation-soft-glow", x: "-20%", y: "-20%", width: "140%", height: "140%" },
          createElement("feGaussianBlur", { stdDeviation: "1.1", result: "blur" }),
          createElement("feColorMatrix", { in: "blur", type: "matrix", values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0" }),
        ),
      ),
      ...renderEdges.map((edge) => {
        const left = edge.sourceNode;
        const right = edge.targetNode;
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
          markerEnd: "url(#relation-arrow)",
          filter: `url(#relation-soft-glow)`,
          style: { filter: `blur(${blur}px)`, pointerEvents: "none" },
        });
      }).filter(Boolean),
      ...renderNodes.map((node) => createElement(
        "g",
        {
          key: node.id,
          transform: `translate(${node.x}, ${node.y}) scale(${node.depthScale})`,
          opacity: node.renderOpacity,
          onClick: (event) => {
            event.stopPropagation();
            const nodeId = extractNodeId(node);
            if (!nodeId) {
              return;
            }

            onNodeSelectRef.current?.({
              ...node,
              id: nodeId,
              nodeId,
            });
          },
          style: { pointerEvents: "auto", cursor: "pointer" },
        },
        createElement(
          "foreignObject",
          {
            x: -(Math.max(80, node.layoutWidth || 220) / 2),
            y: -56,
            width: Math.max(80, node.layoutWidth || 220),
            height: 132,
            style: {
              overflow: "visible",
              pointerEvents: "auto",
              filter: `blur(${clamp(node.depthBlur ?? 0.12, 0.02, 0.42)}px) saturate(${clamp(0.92 + (node.z ?? 1) * 0.08, 0.92, 1.12)})`,
            },
          },
          createElement(
            "div",
            { xmlns: "http://www.w3.org/1999/xhtml" },
            createElement(SemanticNodeCard, {
              title: node.semanticLabel || node.title || node.text,
              text: node.semanticExcerpt || node.wikiSummary || "",
              meta: (node.concepts || node.keywords || []).slice(0, 4).join(" · "),
              nodeId: node.id,
              onClick: undefined,
            }),
          ),
        ),
      )),
    ),
  );
}