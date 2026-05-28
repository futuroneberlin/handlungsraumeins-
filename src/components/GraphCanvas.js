import { createElement, useEffect, useMemo, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { createGraphActions } from "../graph/runtime.js";
import { graphStore } from "../graph/graphState.js";

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
  const phase = String(node.phase || "transformation");
  const resonance = clamp(Number(node.theoryResonanceScore || 0), 0, 1);
  const density = clamp(Number(node.semanticDensity || 0), 0, 1);
  const phaseLift = phase === "stabilization" ? 0.16 : phase === "formation" ? 0.08 : 0;
  const depthScale = clamp(0.9 + resonance * 0.58 + density * 0.24 + phaseLift - distanceRatio * 0.1 + (1.25 - zValue) * 0.16, 0.5, 1.92);
  const depthLift = Math.round((1.35 - zValue) * 24 + activity * 10 - distanceRatio * 10 + Number(physics.depthLift || 0) + (phase === "stabilization" ? 6 : 0));
  const depthBlur = clamp(0.26 + distanceRatio * 0.28 + Math.max(0, zValue - 1) * 0.12 - resonance * 0.14, 0.02, 0.7);

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
  const resonance = clamp(Number(node.theoryResonanceScore || 0), 0, 1);
  const activity = clamp(Number(node.semanticActivity || 0), 0, 1);
  const mass = clamp(Number(physics.semanticMass || node.mass || node.weight || 1), 0.7, 6.2);
  const baseWidth = Math.max(74, Number(node.layoutWidth || 220));
  const phase = String(node.phase || "transformation");
  const phaseBias = phase === "stabilization" ? 0.42 : phase === "formation" ? 0.18 : -0.08;
  const baseHeight = Math.max(34, baseWidth * (0.16 + density * 0.16));
  const width = baseWidth * (0.76 + resonance * 0.76 + activity * 0.12 + phaseBias * 0.14);
  const height = baseHeight * (0.84 + resonance * 0.3 + mass * 0.05 + phaseBias * 0.1);
  const squash = clamp(1 - (node.distanceRatio || 0) * 0.26 + resonance * 0.18 + (phase === "stabilization" ? 0.08 : 0), 0.58, 1.22);
  return {
    width,
    height: height * squash,
    haloWidth: width * (1.18 + activity * 0.18 + (phase === "stabilization" ? 0.1 : 0)),
    haloHeight: height * (1.38 + activity * 0.22 + (phase === "stabilization" ? 0.12 : 0)),
    coreWidth: width * (0.5 + resonance * 0.24),
    coreHeight: height * (0.44 + resonance * 0.22),
    mass,
    density,
    resonance,
    activity,
  };
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) {
      continue;
    }
    element.setAttribute(key, String(value));
  }
  return element;
}

function setSvgElementAttributes(element, attributes = {}) {
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) {
      element.removeAttribute(key);
      continue;
    }

    if (key === "style") {
      element.setAttribute(key, String(value));
      continue;
    }

    element.setAttribute(key, String(value));
  }
}

function createNodeVisual(nodeId, onNodeSelect) {
  const group = createSvgElement("g", { "data-node-id": nodeId, style: "pointer-events:auto;cursor:pointer" });
  const orbit = createSvgElement("ellipse", { cx: 0, cy: 0, fill: "none" });
  const halo = createSvgElement("ellipse", { cx: 0, cy: 0 });
  const body = createSvgElement("ellipse", { cx: 0, cy: 0 });
  const core = createSvgElement("ellipse", { cx: 0, cy: 0 });
  const particles = [0, 1, 2].map(() => createSvgElement("circle", { cx: 0, cy: 0 }));

  group.append(orbit, halo, body, core, ...particles);
  group.addEventListener("click", (event) => {
    event.stopPropagation();
    onNodeSelect?.(nodeId);
  });

  return {
    group,
    orbit,
    halo,
    body,
    core,
    particles,
  };
}

function createLinkVisual() {
  return createSvgElement("path", {
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pointerEvents: "none",
    markerEnd: "url(#relation-arrow)",
  });
}

export function GraphCanvas({ store, onNodeSelect, debugNodes = null, debugEdges = null, className = "", style, ...rest }) {
  const effectiveStore = store || graphStore;
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const centerForceRef = useRef(null);
  const linkForceRef = useRef(null);
  const collisionForceRef = useRef(null);
  const nodesLayerRef = useRef(null);
  const linksLayerRef = useRef(null);
  const nodeElementsRef = useRef(new Map());
  const linkElementsRef = useRef(new Map());
  const renderSceneRef = useRef(null);
  const sceneRef = useRef({
    nodes: [],
    links: [],
    width: 0,
    height: 0,
    selectedNodeId: null,
    activityMap: new Map(),
    neighborIds: new Set(),
  });
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

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || simulationRef.current) {
      return undefined;
    }

    svg.innerHTML = "";

    const defs = createSvgElement("defs");
    const marker = createSvgElement("marker", {
      id: "relation-arrow",
      markerWidth: 8,
      markerHeight: 8,
      refX: 7,
      refY: 3.5,
      orient: "auto",
      markerUnits: "strokeWidth",
    });
    marker.appendChild(createSvgElement("path", { d: "M0,0 L0,7 L7,3.5 z", fill: "#ffffff", "fill-opacity": 0.78 }));
    const filter = createSvgElement("filter", { id: "relation-soft-glow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    filter.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: 1.1, result: "blur" }));
    filter.appendChild(createSvgElement("feColorMatrix", { in: "blur", type: "matrix", values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0" }));
    defs.append(marker, filter);

    const linksLayer = createSvgElement("g", { class: "edge-layer-root" });
    const nodesLayer = createSvgElement("g", { class: "node-layer-root" });
    svg.append(defs, linksLayer, nodesLayer);

    const centerForce = forceCenter(0, 0);
    const linkForce = forceLink([])
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
    const collisionForce = forceCollide()
      .radius((node) => {
        const physics = node.semanticPhysics || {};
        return Math.max(44, physics.collisionRadius || (node.layoutWidth || 220) * 0.24);
      })
      .iterations(2);

    const simulation = forceSimulation([])
      .force("center", centerForce)
      .force("link", linkForce)
      .force("charge", forceManyBody().strength((node) => {
        const physics = node.semanticPhysics || {};
        const resonance = Number(node.theoryResonanceScore || 0);
        return -(52 + (physics.semanticMass || 1) * 22 + resonance * 14 + (node.semanticDensity || 0) * 18);
      }))
      .force("collision", collisionForce);

    simulation.on("tick", () => {
      const scene = sceneRef.current;
      const { nodes, links, selectedNodeId, neighborIds, activityMap, width, height } = scene;

      const nodeLookup = new Map(nodes.map((node) => [node.id, node]));

      for (const node of nodes) {
        const nodeElements = nodeElementsRef.current.get(node.id);
        if (!nodeElements) {
          continue;
        }

        const activity = clamp((activityMap.get(node.id) || 0) / 3.2, 0, 1);
        const { depthScale, depthLift, depthBlur } = projectNodeDepth({ ...node, semanticActivity: activity }, width, height);
        const isSelected = selectedNodeId && node.id === selectedNodeId;
        const isNeighbor = selectedNodeId && neighborIds.has(node.id);
        const body = projectNodeBody({ ...node, semanticActivity: activity, distanceRatio: clamp(Math.hypot((node.x || 0) - width * 0.5, (node.y || 0) - height * 0.5) / Math.max(120, Math.hypot(width * 0.5, height * 0.5)), 0, 1) });
        const resonance = clamp(Number(node.theoryResonanceScore || 0), 0, 1);
        const phase = String(node.phase || "transformation");
        const opacity = clamp((node.atmosphericOpacity ?? node.opacity ?? 0.82) * (isSelected ? 1 : isNeighbor ? 0.94 : resonance < 0.22 ? 0.7 : 0.9), 0.04, 1);
        const transform = `translate(${node.x || 0}, ${node.y + depthLift || 0}) scale(${clamp(depthScale + (isSelected ? 0.28 : isNeighbor ? 0.14 : 0), 0.5, 2)})`;

        nodeElements.group.setAttribute("transform", transform);
        nodeElements.group.setAttribute("opacity", String(opacity));
        nodeElements.group.setAttribute("data-selected", isSelected ? "true" : "false");
        nodeElements.group.setAttribute("data-neighbor", isNeighbor ? "true" : "false");

        setSvgElementAttributes(nodeElements.orbit, {
          rx: nodeElements.body ? Number(nodeElements.body.getAttribute("rx") || 0) * 1.14 : Math.max(58, (node.layoutWidth || 220) * 0.34),
          ry: nodeElements.body ? Number(nodeElements.body.getAttribute("ry") || 0) * 1.2 : Math.max(24, (node.layoutWidth || 220) * 0.1),
          stroke: isSelected ? "#f6f0e7" : isNeighbor ? "#d9caa8" : "#ffffff",
          strokeOpacity: isSelected ? 0.28 : isNeighbor ? 0.16 : 0.08,
          strokeWidth: isSelected ? 1.6 : isNeighbor ? 1.2 : 0.9,
          strokeDasharray: resonance < 0.3 ? "3 7" : null,
        });

        setSvgElementAttributes(nodeElements.halo, {
          rx: body.haloWidth ? body.haloWidth * 0.5 : Math.max(52, (node.layoutWidth || 220) * 0.32),
          ry: body.haloHeight ? body.haloHeight * 0.5 : Math.max(26, (node.layoutWidth || 220) * 0.11),
          fill: "#f3ebdf",
          fillOpacity: clamp(0.06 + (body.activity || 0) * 0.14 + (isSelected ? 0.06 : 0), 0.03, 0.26),
          stroke: "#f6f0e7",
          strokeOpacity: isSelected ? 0.18 : 0.08,
          strokeWidth: 1,
          style: `filter: blur(${clamp(depthBlur * 1.2, 0.02, 0.7)}px);`,
        });

        setSvgElementAttributes(nodeElements.body, {
          rx: body.width ? body.width * 0.5 : Math.max(34, (node.layoutWidth || 220) * 0.22),
          ry: body.height ? body.height * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.07),
          fill: node.id === "theory-core-actional-space" ? "#f4d37a" : "#efe3ce",
          fillOpacity: clamp(0.12 + body.resonance * 0.66 + body.activity * 0.12 + (isSelected ? 0.22 : isNeighbor ? 0.1 : 0), 0.08, 0.99),
          stroke: "#ffffff",
          strokeOpacity: clamp(0.1 + body.density * 0.22, 0.04, 0.36),
          strokeWidth: clamp(0.72 + body.mass * 0.14 + (isSelected ? 0.18 : 0), 0.7, 2.1),
        });

        setSvgElementAttributes(nodeElements.core, {
          rx: body.coreWidth ? body.coreWidth * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.12),
          ry: body.coreHeight ? body.coreHeight * 0.5 : Math.max(8, (node.layoutWidth || 220) * 0.04),
          fill: "#fffaf0",
          fillOpacity: clamp(0.1 + body.resonance * 0.4 + (isSelected ? 0.12 : 0), 0.06, 0.82),
          style: `filter: blur(${clamp(depthBlur * 0.45, 0.01, 0.22)}px);`,
        });

        nodeElements.particles.forEach((particle, particleIndex) => {
          const angle = (particleIndex / Math.max(1, Math.min(3, node.concepts?.length || 3))) * Math.PI * 2;
          setSvgElementAttributes(particle, {
            cx: Math.cos(angle) * ((body.width || 40) * 0.22),
            cy: Math.sin(angle) * ((body.height || 18) * 0.34),
            r: 1.3 + body.activity * 1.1 + (isSelected ? 0.4 : 0),
            fill: "#ffffff",
            fillOpacity: clamp(0.18 + body.activity * 0.34 + (isSelected ? 0.18 : 0), 0.1, 0.82),
          });
        });
      }

      for (const [edgeId, edgeElement] of linkElementsRef.current.entries()) {
        const edge = scene.links.find((candidate) => candidate.id === edgeId);
        if (!edge) {
          edgeElement.remove();
          linkElementsRef.current.delete(edgeId);
          continue;
        }

        const left = nodeLookup.get(edge.source?.id || edge.source);
        const right = nodeLookup.get(edge.target?.id || edge.target);
        if (!left || !right) {
          continue;
        }

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

        setSvgElementAttributes(edgeElement, {
          d,
          stroke: edge.type === "wiki" || edge.type === "theory" ? "#c9a227" : "#ffffff",
          strokeOpacity: Math.min(0.98, Math.max(0.03, (edge.opacity ?? 0.06) + Math.min(0.48, semanticStrength * 0.24) + Math.min(0.24, (edge.confidence || 0) * 0.2) + (selectedEdge ? 0.28 : 0) - (selectedNodeId && !selectedEdge ? 0.16 : 0))),
          strokeWidth: Math.max(0.42, 0.46 + semanticStrength * 0.58 + Math.min(0.5, (edge.confidence || 0) * 0.38) + (selectedEdge ? 0.36 : 0)),
          style: `filter: blur(${clamp(1.42 - semanticStrength * 0.34, 0.1, 1.5)}px);`,
        });
      }
    });

    simulationRef.current = simulation;
    centerForceRef.current = centerForce;
    linkForceRef.current = linkForce;
    collisionForceRef.current = collisionForce;
    nodesLayerRef.current = nodesLayer;
    linksLayerRef.current = linksLayer;

    return () => {
      simulation.stop();
      simulationRef.current = null;
      centerForceRef.current = null;
      linkForceRef.current = null;
      collisionForceRef.current = null;
      nodeElementsRef.current.clear();
      linkElementsRef.current.clear();
      if (svg) {
        svg.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    const syncScene = () => {
      const svg = svgRef.current;
      const simulation = simulationRef.current;
      const centerForce = centerForceRef.current;
      const linkForce = linkForceRef.current;
      const collisionForce = collisionForceRef.current;
      if (!svg || !simulation || !centerForce || !linkForce || !collisionForce) {
        return;
      }

      const state = effectiveStore.getState();
      const hasRealNodes = (state.nodes || []).length > 0;
      const sourceNodes = hasRealNodes ? (state.nodes || []) : (debugNodes || []);
      const sourceEdges = hasRealNodes ? (state.edges || []) : (debugEdges || []);
      const width = Math.max(320, state.viewport?.width || 960);
      const height = Math.max(240, state.viewport?.height || 560);
      const selectedNodeId = state.selectedNode || null;

      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

      const existingNodes = new Map(sceneRef.current.nodes.map((node) => [node.id, node]));
      const mergedNodes = sourceNodes.map((snapshot, index) => {
        const nodeId = extractNodeId(snapshot) || `node-${index}`;
        const existing = existingNodes.get(nodeId);
        const fallbackAngle = (index / Math.max(1, sourceNodes.length)) * Math.PI * 2;
        const fallbackRadius = Math.min(width, height) * 0.26;
        const nextX = Number.isFinite(snapshot.x) ? snapshot.x : width * 0.5 + Math.cos(fallbackAngle) * fallbackRadius;
        const nextY = Number.isFinite(snapshot.y) ? snapshot.y : height * 0.5 + Math.sin(fallbackAngle) * fallbackRadius;

        if (existing) {
          Object.assign(existing, snapshot, {
            id: nodeId,
            x: Number.isFinite(existing.x) ? existing.x : nextX,
            y: Number.isFinite(existing.y) ? existing.y : nextY,
            vx: Number.isFinite(existing.vx) ? existing.vx : 0,
            vy: Number.isFinite(existing.vy) ? existing.vy : 0,
            semanticPhysics: snapshot.semanticPhysics || existing.semanticPhysics || {},
          });
          return existing;
        }

        return {
          ...snapshot,
          id: nodeId,
          x: nextX,
          y: nextY,
          vx: Number.isFinite(snapshot.vx) ? snapshot.vx : 0,
          vy: Number.isFinite(snapshot.vy) ? snapshot.vy : 0,
          semanticPhysics: snapshot.semanticPhysics || {},
        };
      });

      const nodeLookup = new Map(mergedNodes.map((node) => [node.id, node]));
      const activityMap = createFeedActivityIndex({ ...state, nodes: mergedNodes });

      const mergedLinks = sourceEdges
        .slice(0, 900)
        .map((edge, edgeIndex) => {
          const sourceNode = resolveEndpoint(edge.source ?? edge.leftId ?? edge.sourceId ?? edge.leftIndex, nodeLookup, mergedNodes);
          const targetNode = resolveEndpoint(edge.target ?? edge.rightId ?? edge.targetId ?? edge.rightIndex, nodeLookup, mergedNodes);
          if (!sourceNode || !targetNode) {
            return null;
          }

          return {
            ...edge,
            id: edge.id || `edge-${edgeIndex}`,
            source: sourceNode,
            target: targetNode,
            sourceNode,
            targetNode,
          };
        })
        .filter(Boolean);

      const neighborIds = new Set();
      if (selectedNodeId) {
        for (const edge of mergedLinks) {
          const sourceId = String(edge.source?.id || edge.sourceNode?.id || edge.source || "");
          const targetId = String(edge.target?.id || edge.targetNode?.id || edge.target || "");
          if (sourceId === selectedNodeId) {
            neighborIds.add(targetId);
          }
          if (targetId === selectedNodeId) {
            neighborIds.add(sourceId);
          }
        }
      }

      sceneRef.current = {
        nodes: mergedNodes,
        links: mergedLinks,
        width,
        height,
        selectedNodeId,
        activityMap,
        neighborIds,
      };

      mergedNodes.forEach((node) => {
        if (!nodeElementsRef.current.has(node.id)) {
          const visual = createNodeVisual(node.id, (nodeId) => {
            onNodeSelectRef.current?.({ ...nodeLookup.get(nodeId), id: nodeId, nodeId });
          });
          nodeElementsRef.current.set(node.id, visual);
          nodesLayerRef.current?.appendChild(visual.group);
        }
      });

      for (const [nodeId, visual] of nodeElementsRef.current.entries()) {
        if (!nodeLookup.has(nodeId)) {
          visual.group.remove();
          nodeElementsRef.current.delete(nodeId);
        }
      }

      mergedLinks.forEach((edge) => {
        if (!linkElementsRef.current.has(edge.id)) {
          const visual = createLinkVisual();
          linkElementsRef.current.set(edge.id, visual);
          linksLayerRef.current?.appendChild(visual);
        }
      });

      for (const [edgeId, visual] of linkElementsRef.current.entries()) {
        if (!mergedLinks.some((edge) => edge.id === edgeId)) {
          visual.remove();
          linkElementsRef.current.delete(edgeId);
        }
      }

      centerForce.x(width * 0.5).y(height * 0.5);
      linkForce.links(mergedLinks);
      collisionForce.radius((node) => {
        const physics = node.semanticPhysics || {};
        const activity = clamp((activityMap.get(node.id) || 0) / 3.2, 0, 1);
        return Math.max(44, physics.collisionRadius || (node.layoutWidth || 220) * (0.18 + activity * 0.14));
      });
      simulation.nodes(mergedNodes);
      simulation.alphaTarget(0.12).restart();

      if (renderSceneRef.current) {
        renderSceneRef.current();
      }
    };

    renderSceneRef.current = () => {
      const scene = sceneRef.current;
      const { nodes, links, selectedNodeId: currentSelectedNodeId, neighborIds: currentNeighborIds, activityMap: currentActivityMap, width: currentWidth, height: currentHeight } = scene;
      const nodeLookup = new Map(nodes.map((node) => [node.id, node]));

      for (const node of nodes) {
        const visual = nodeElementsRef.current.get(node.id);
        if (!visual) {
          continue;
        }

        const activity = clamp((currentActivityMap.get(node.id) || 0) / 3.2, 0, 1);
        const distanceRatio = clamp(Math.hypot((node.x || currentWidth * 0.5) - currentWidth * 0.5, (node.y || currentHeight * 0.5) - currentHeight * 0.5) / Math.max(120, Math.hypot(currentWidth * 0.5, currentHeight * 0.5)), 0, 1);
        const depthState = projectNodeDepth({ ...node, semanticActivity: activity }, currentWidth, currentHeight);
        const body = projectNodeBody({ ...node, semanticActivity: activity, distanceRatio });
        const isSelected = currentSelectedNodeId && node.id === currentSelectedNodeId;
        const isNeighbor = currentSelectedNodeId && currentNeighborIds.has(node.id);
        const resonance = clamp(Number(node.theoryResonanceScore || 0), 0, 1);
        const focusBoost = isSelected ? 0.42 : isNeighbor ? 0.18 : 0;
        const weakFade = resonance < 0.22 ? 0.7 : resonance < 0.45 ? 0.88 : 1;

        setSvgElementAttributes(visual.group, {
          transform: `translate(${node.x || 0}, ${((node.y || 0) + depthState.depthLift) || 0}) scale(${clamp(depthState.depthScale + focusBoost, 0.5, 2)})`,
          opacity: clamp((node.atmosphericOpacity ?? node.opacity ?? 0.82) * weakFade * (0.18 + activity * 0.82) * (isSelected ? 1 : isNeighbor ? 0.94 : 0.74), 0.04, 1),
          "data-selected": isSelected ? "true" : "false",
          "data-neighbor": isNeighbor ? "true" : "false",
        });

        setSvgElementAttributes(visual.orbit, {
          rx: body.width ? body.width * 0.6 : Math.max(58, (node.layoutWidth || 220) * 0.34),
          ry: body.height ? body.height * 0.7 : Math.max(24, (node.layoutWidth || 220) * 0.1),
          stroke: isSelected ? "#f6f0e7" : isNeighbor ? "#d9caa8" : "#ffffff",
          strokeOpacity: isSelected ? 0.28 : isNeighbor ? 0.16 : 0.08,
          strokeWidth: isSelected ? 1.6 : isNeighbor ? 1.2 : 0.9,
          strokeDasharray: resonance < 0.3 ? "3 7" : null,
        });

        setSvgElementAttributes(visual.halo, {
          rx: body.haloWidth ? body.haloWidth * 0.5 : Math.max(52, (node.layoutWidth || 220) * 0.32),
          ry: body.haloHeight ? body.haloHeight * 0.5 : Math.max(26, (node.layoutWidth || 220) * 0.11),
          fill: "#f3ebdf",
          fillOpacity: clamp(0.06 + (body.activity || 0) * 0.14 + (isSelected ? 0.06 : 0), 0.03, 0.26),
          stroke: "#f6f0e7",
          strokeOpacity: isSelected ? 0.18 : 0.08,
          strokeWidth: 1,
          style: `filter: blur(${clamp(depthState.depthBlur * 1.2, 0.02, 0.7)}px);`,
        });

        setSvgElementAttributes(visual.body, {
          rx: body.width ? body.width * 0.5 : Math.max(34, (node.layoutWidth || 220) * 0.22),
          ry: body.height ? body.height * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.07),
          fill: node.id === "theory-core-actional-space" ? "#f4d37a" : "#efe3ce",
          fillOpacity: clamp(0.12 + body.resonance * 0.66 + body.activity * 0.12 + (isSelected ? 0.22 : isNeighbor ? 0.1 : 0), 0.08, 0.99),
          stroke: "#ffffff",
          strokeOpacity: clamp(0.1 + body.density * 0.22, 0.04, 0.36),
          strokeWidth: clamp(0.72 + body.mass * 0.14 + (isSelected ? 0.18 : 0), 0.7, 2.1),
        });

        setSvgElementAttributes(visual.core, {
          rx: body.coreWidth ? body.coreWidth * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.12),
          ry: body.coreHeight ? body.coreHeight * 0.5 : Math.max(8, (node.layoutWidth || 220) * 0.04),
          fill: "#fffaf0",
          fillOpacity: clamp(0.1 + body.resonance * 0.4 + (isSelected ? 0.12 : 0), 0.06, 0.82),
          style: `filter: blur(${clamp(depthState.depthBlur * 0.45, 0.01, 0.22)}px);`,
        });

        visual.particles.forEach((particle, particleIndex) => {
          const angle = (particleIndex / Math.max(1, Math.min(3, node.concepts?.length || 3))) * Math.PI * 2;
          setSvgElementAttributes(particle, {
            cx: Math.cos(angle) * ((body.width || 40) * 0.22),
            cy: Math.sin(angle) * ((body.height || 18) * 0.34),
            r: 1.3 + body.activity * 1.1 + (isSelected ? 0.4 : 0),
            fill: "#ffffff",
            fillOpacity: clamp(0.18 + body.activity * 0.34 + (isSelected ? 0.18 : 0), 0.1, 0.82),
          });
        });
      }

      for (const [edgeId, visual] of linkElementsRef.current.entries()) {
        const edge = links.find((candidate) => candidate.id === edgeId);
        if (!edge) {
          continue;
        }

        const left = nodeLookup.get(edge.source?.id || edge.sourceNode?.id || edge.source);
        const right = nodeLookup.get(edge.target?.id || edge.targetNode?.id || edge.target);
        if (!left || !right) {
          continue;
        }

        const semanticStrength = edge.semanticStrength ?? edge.score ?? edge.weight ?? 0;
        const selectedEdge = currentSelectedNodeId && (left.id === currentSelectedNodeId || right.id === currentSelectedNodeId);
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

        setSvgElementAttributes(visual, {
          d,
          stroke: edge.type === "wiki" || edge.type === "theory" ? "#c9a227" : "#ffffff",
          strokeOpacity: Math.min(0.98, Math.max(0.03, (edge.opacity ?? 0.06) + Math.min(0.48, semanticStrength * 0.24) + Math.min(0.24, (edge.confidence || 0) * 0.2) + (selectedEdge ? 0.28 : 0) - (currentSelectedNodeId && !selectedEdge ? 0.16 : 0))),
          strokeWidth: Math.max(0.42, 0.46 + semanticStrength * 0.58 + Math.min(0.5, (edge.confidence || 0) * 0.38) + (selectedEdge ? 0.36 : 0)),
          style: `filter: blur(${clamp(1.42 - semanticStrength * 0.34, 0.1, 1.5)}px);`,
        });
      }
    };

    syncScene();
    const unsubscribe = effectiveStore.subscribe(syncScene);

    return () => {
      unsubscribe();
      renderSceneRef.current = null;
    };
  }, [effectiveStore, debugEdges, debugNodes]);

  return createElement(
    "div",
    { className: `graph-center ${className}`.trim(), ref: containerRef, style: { position: "relative", width: "100%", height: "100%", ...style }, ...rest },
    createElement("svg", {
      ref: svgRef,
      className: "edge-layer",
      style: { position: "absolute", inset: 0, pointerEvents: "auto" },
      width: "100%",
      height: "100%",
      viewBox: `0 0 960 560`,
    }),
  );
}