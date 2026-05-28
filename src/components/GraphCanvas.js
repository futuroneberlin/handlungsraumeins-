import { createElement, useEffect, useMemo, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { createGraphActions } from "../graph/runtime.js";
import { useGraphVersion, graphStore } from "../graph/graphState.js";

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
  const physics = node.semanticPhysics || {};
  const zValue = Number.isFinite(node.z) ? node.z : Number(physics.depth || 1);
  const activity = Number.isFinite(node.semanticActivity) ? node.semanticActivity : 0;
  const depthScale = clamp(1.12 - distanceRatio * 0.18 + (1.25 - zValue) * 0.22 + activity * 0.08, 0.68, 1.5);
  const depthLift = Math.round((1.25 - zValue) * 20 + activity * 8 - distanceRatio * 8 + Number(physics.depthLift || 0));
  const depthBlur = clamp(0.36 + distanceRatio * 0.22 + Math.max(0, zValue - 1) * 0.08 - activity * 0.11, 0.02, 0.56);

  return {
    depthScale,
    distanceRatio,
    depthLift,
    depthBlur,
  };
}

function projectNodeBody(node) {
  const physics = node.semanticPhysics || {};
  const density = clamp(Number(node.semanticDensity || 0), 0, 1);
  const resonance = clamp(Number(node.theoryResonanceScore || 0) / 4, 0, 1);
  const activity = clamp(Number(node.semanticActivity || 0), 0, 1);
  const mass = clamp(Number(physics.semanticMass || node.mass || node.weight || 1), 0.7, 6.2);
  const baseWidth = Math.max(74, Number(node.layoutWidth || 220));
  const baseHeight = Math.max(34, baseWidth * (0.18 + density * 0.08));
  const width = baseWidth * (0.84 + resonance * 0.36 + activity * 0.1);
  const height = baseHeight * (0.9 + resonance * 0.22 + mass * 0.03);
  const squash = clamp(1 - (node.distanceRatio || 0) * 0.2 + resonance * 0.12, 0.66, 1.12);
  return {
    width,
    height: height * squash,
    haloWidth: width * (1.22 + activity * 0.18),
    haloHeight: height * (1.48 + activity * 0.22),
    coreWidth: width * (0.58 + resonance * 0.12),
    coreHeight: height * (0.5 + resonance * 0.12),
    mass,
    density,
    resonance,
    activity,
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
  const selectedNodeId = state.selectedNode || null;

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
      const physics = node.semanticPhysics || {};

      return {
        ...node,
        id: nodeId,
        x,
        y,
        semanticPhysics: physics,
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

    const neighborIds = new Set();
    if (selectedNodeId) {
      for (const edge of links) {
        const sourceId = String(edge.source || edge.sourceNode?.id || "");
        const targetId = String(edge.target || edge.targetNode?.id || "");
        if (sourceId === selectedNodeId) {
          neighborIds.add(targetId);
        }
        if (targetId === selectedNodeId) {
          neighborIds.add(sourceId);
        }
      }
    }

    const linkForce = forceLink(links)
      .id((node) => node.id)
      .distance((edge) => {
        const physics = edge.sourceNode?.semanticPhysics || edge.targetNode?.semanticPhysics || {};
        const strength = Number(edge.semanticStrength ?? edge.score ?? edge.weight ?? 0);
        return clamp((physics.orbitRadius || 180) - strength * 26, 72, 280);
      })
      .strength((edge) => {
        const confidence = Number(edge.confidence || edge.semanticStrength || edge.score || edge.weight || 0);
        return clamp(0.12 + confidence * 0.16, 0.08, 0.34);
      });

    const collision = forceCollide()
      .radius((node) => {
        const physics = node.semanticPhysics || {};
        const activity = clamp((activityMap.get(node.id) || 0) / 3.2, 0, 1);
        return Math.max(44, physics.collisionRadius || (node.layoutWidth || 220) * (0.22 + activity * 0.1));
      })
      .iterations(2);

    const simulationModel = forceSimulation(nodes)
      .force("center", forceCenter(centerX, centerY))
      .force("link", linkForce)
      .force("charge", forceManyBody().strength((node) => {
        const physics = node.semanticPhysics || {};
        const resonance = Number(node.theoryResonanceScore || 0);
        return -(52 + (physics.semanticMass || 1) * 22 + resonance * 14 + (node.semanticDensity || 0) * 18);
      }))
      .force("collision", collision)
      .stop();

    for (let tick = 0; tick < 24; tick += 1) {
      simulationModel.tick();
    }

    const projectedNodes = nodes
      .map((node) => {
        const activity = clamp((activityMap.get(node.id) || 0) / 3.2, 0, 1);
        const { depthScale, distanceRatio, depthLift, depthBlur } = projectNodeDepth(node, width, height);
        const baseOpacity = clamp(node.atmosphericOpacity ?? node.opacity ?? 0.82, 0.2, 1);
        const body = projectNodeBody({ ...node, semanticActivity: activity, distanceRatio });
        const physics = node.semanticPhysics || {};
        const isSelected = selectedNodeId && node.id === selectedNodeId;
        const isNeighbor = selectedNodeId && neighborIds.has(node.id);
        const focusBoost = isSelected ? 0.28 : isNeighbor ? 0.14 : 0;

        return {
          ...node,
          depthScale: clamp(depthScale + focusBoost, 0.68, 1.7),
          distanceRatio,
          depthLift,
          depthBlur,
          body,
          semanticActivity: activity,
          renderOpacity: clamp(baseOpacity * (0.26 + activity * 0.74) * (isSelected ? 1 : isNeighbor ? 0.92 : 0.78) * (0.96 - Math.min(0.28, Math.max(0, ((node.z ?? physics.depth) || 1) - 1) * 0.12)), 0.06, 1),
          orbitOpacity: clamp(0.18 + (physics.persistence || 0.4) * 0.62, 0.12, 0.9),
          isSelected,
          isNeighbor,
        };
      })
      .sort((left, right) => (right.z ?? 0) - (left.z ?? 0) || right.distanceRatio - left.distanceRatio);

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
        const selectedEdge = selectedNodeId && (left.id === selectedNodeId || right.id === selectedNodeId);
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
        const tension = clamp(0.04 + semanticStrength * 0.12 + depthSpan * 0.08 + Math.min(0.26, (edge.confidence || 0) * 0.18), 0.04, 0.52);
        const curveX = midpointX + nx * distance * tension;
        const curveY = midpointY + ny * distance * tension * 0.72;
        const d = `M ${left.x} ${left.y} Q ${curveX} ${curveY} ${right.x} ${right.y}`;
        const alpha = Math.min(0.98, Math.max(0.03, (edge.opacity ?? 0.08) + Math.min(0.56, semanticStrength * 0.2) + Math.min(0.28, (edge.confidence || 0) * 0.26) + (selectedEdge ? 0.24 : 0) - (selectedNodeId && !selectedEdge ? 0.14 : 0)));
        const strokeWidth = Math.max(0.45, 0.52 + semanticStrength * 0.52 + Math.min(0.6, (edge.confidence || 0) * 0.42) + (selectedEdge ? 0.3 : 0));
        const blur = clamp(1.42 - semanticStrength * 0.34, 0.1, 1.5);
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
          transform: `translate(${node.x}, ${node.y + node.depthLift}) scale(${node.depthScale})`,
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
        createElement("ellipse", {
          cx: 0,
          cy: 0,
          rx: node.body?.haloWidth ? node.body.haloWidth * 0.5 : Math.max(52, (node.layoutWidth || 220) * 0.32),
          ry: node.body?.haloHeight ? node.body.haloHeight * 0.5 : Math.max(26, (node.layoutWidth || 220) * 0.11),
          fill: "#f3ebdf",
          fillOpacity: clamp(0.08 + (node.body?.activity || 0) * 0.14, 0.04, 0.24),
          stroke: "#f6f0e7",
          strokeOpacity: 0.08,
          strokeWidth: 1,
          style: { filter: `blur(${clamp((node.depthBlur || 0.12) * 1.2, 0.02, 0.7)}px)` },
        }),
        createElement("ellipse", {
          cx: 0,
          cy: 0,
          rx: node.body?.width ? node.body.width * 0.5 : Math.max(34, (node.layoutWidth || 220) * 0.22),
          ry: node.body?.height ? node.body.height * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.07),
          fill: node.id === "theory-core-actional-space" ? "#f4d37a" : "#efe3ce",
          fillOpacity: clamp(0.2 + (node.body?.resonance || 0) * 0.54 + (node.body?.activity || 0) * 0.18 + (node.isSelected ? 0.16 : node.isNeighbor ? 0.08 : 0), 0.12, 0.98),
          stroke: "#ffffff",
          strokeOpacity: clamp(0.1 + (node.body?.density || 0) * 0.22, 0.04, 0.36),
          strokeWidth: clamp(0.7 + (node.body?.mass || 1) * 0.1, 0.7, 1.8),
        }),
        createElement("ellipse", {
          cx: -Math.max(4, (node.body?.width || 60) * 0.08),
          cy: -Math.max(2, (node.body?.height || 24) * 0.08),
          rx: node.body?.coreWidth ? node.body.coreWidth * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.12),
          ry: node.body?.coreHeight ? node.body.coreHeight * 0.5 : Math.max(8, (node.layoutWidth || 220) * 0.04),
          fill: "#fffaf0",
          fillOpacity: clamp(0.16 + (node.body?.resonance || 0) * 0.34 + (node.isSelected ? 0.08 : 0), 0.08, 0.78),
          style: { filter: `blur(${clamp((node.depthBlur || 0.12) * 0.45, 0.01, 0.22)}px)` },
        }),
        ...(Array.isArray(node.concepts) ? node.concepts.slice(0, 3).map((concept, conceptIndex) => createElement("circle", {
          key: `${node.id}-particle-${conceptIndex}`,
          cx: Math.cos((conceptIndex / Math.max(1, Math.min(3, node.concepts.length))) * Math.PI * 2) * ((node.body?.width || 40) * 0.22),
          cy: Math.sin((conceptIndex / Math.max(1, Math.min(3, node.concepts.length))) * Math.PI * 2) * ((node.body?.height || 18) * 0.34),
          r: 1.5 + (node.body?.activity || 0) * 1.2,
          fill: "#ffffff",
          fillOpacity: clamp(0.32 + (node.body?.activity || 0) * 0.28, 0.12, 0.7),
        })) : []),
      )),
    ),
  );
}