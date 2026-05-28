import { createElement, useEffect, useMemo, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { createGraphActions } from "../graph/runtime.js";
import { graphStore } from "../graph/graphState.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "of",
  "for",
  "in",
  "to",
  "with",
  "through",
  "into",
  "from",
  "by",
  "on",
  "at",
  "a",
  "an",
  "as",
  "is",
  "are",
  "be",
  "this",
  "that",
  "these",
  "those",
  "using",
  "via",
  "about",
  "over",
  "under",
  "between",
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTerm(term) {
  return String(term || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function hashString(value) {
  let hash = 0;
  for (const character of String(value || "")) {
    hash = (hash * 31 + character.codePointAt(0)) % 2147483647;
  }
  return Math.abs(hash);
}

function seededUnit(value, salt = 0) {
  return ((hashString(`${value}:${salt}`) % 1000) + 0.5) / 1000;
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

  const identity = node.wikiTitle || node.title || node.semanticLabel || node.keyword || node.text || node.wikiUrl;
  return normalizeKey(identity);
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

function wordTokens(value) {
  return normalizeTerm(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOPWORDS.has(word) && !/^(?:edit|stub|wikipedia|citation|template|page|pages|article|articles)$/i.test(word));
}

function compressPhrase(value, maxWords = 3) {
  return wordTokens(value).slice(0, maxWords).join(" ");
}

function collectNodeFragments(node) {
  const collected = [];
  const sources = [
    node.semanticLabel,
    node.title,
    node.keyword,
    node.text,
    ...(node.concepts || []),
    ...(node.keywords || []),
    ...(node.wikiCategories || []),
    ...(node.theoryDimensions || []),
  ];

  for (const source of sources) {
    const phrase = compressPhrase(source, 4);
    if (!phrase || collected.includes(phrase)) {
      continue;
    }

    collected.push(phrase);
    if (collected.length >= 6) {
      break;
    }
  }

  if (!collected.length && node.summary) {
    const summaryFragments = normalizeTerm(node.summary)
      .split(/(?<=[.!?])\s+/)
      .map((segment) => compressPhrase(segment, 4))
      .filter(Boolean);
    collected.push(...summaryFragments.slice(0, 4));
  }

  const primary = collected[0] || compressPhrase(node.title || node.wikiTitle || node.semanticLabel || node.keyword || "semantic body", 4) || "semantic body";
  const secondary = collected.slice(1, 4).join(" · ") || compressPhrase((node.theoryDimensions || []).join(" "), 3) || compressPhrase((node.wikiCategories || []).join(" "), 3) || "";

  return { primary, secondary, fragments: collected };
}

function createFeedActivityIndex(state) {
  const activityMap = new Map();
  const feedLines = state.feedLines || [];
  const feedText = feedLines
    .map((line) => `${line.title || ""} ${line.text || ""} ${(line.keywords || []).join(" ")}`.toLowerCase())
    .join(" || ");

  for (const line of feedLines) {
    const lineNodeId = String(line.nodeId || "").trim();
    if (lineNodeId) {
      activityMap.set(lineNodeId, (activityMap.get(lineNodeId) || 0) + 1.6);
    }
  }

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
      if (feedText.includes(token)) {
        score += 0.32;
      }
    }
    activityMap.set(nodeId, score);
  }

  return activityMap;
}

function inferNodeStage(node) {
  const phase = String(node.phase || node.stage || "").toLowerCase();
  const resonance = clamp(Number(node.theoryResonanceScore || 0), 0, 1);
  const density = clamp(Number(node.semanticDensity || 0), 0, 1);

  if (phase === "ingestion" || phase === "arrival" || phase === "queued" || phase === "foundation") {
    return "ingestion";
  }

  if (phase === "stabilization" || phase === "resolution" || phase === "theory") {
    return "resolution";
  }

  if (resonance >= 0.68 || density >= 0.78 || node.id === "theory-core-actional-space" || node.isTheoryCore) {
    return "resolution";
  }

  return "condensation";
}

function deriveNodeMorphology(node, activity, width, height, index) {
  const resonance = clamp(Number(node.theoryResonanceScore || 0), 0, 1);
  const density = clamp(Number(node.semanticDensity || 0), 0, 1);
  const stage = inferNodeStage(node);
  const temperature = clamp(1 - resonance * 0.54 + activity * 0.16 + (stage === "ingestion" ? 0.18 : 0) + (stage === "resolution" ? -0.1 : 0), 0.08, 1.4);
  const mass = clamp(0.95 + resonance * 4.8 + density * 1.6 + (stage === "resolution" ? 0.7 : stage === "ingestion" ? -0.2 : 0), 0.72, 7.8);
  const stability = clamp(resonance * 0.78 + density * 0.22 + (stage === "resolution" ? 0.18 : 0) - temperature * 0.12, 0.05, 1);
  const velocity = clamp(1.55 - stability * 0.82 + temperature * 0.52, 0.18, 1.7);
  const depth = clamp(0.24 + resonance * 0.68 + stability * 0.18 - temperature * 0.12 + (stage === "resolution" ? 0.1 : 0), 0, 1);
  const flowMomentum = stage === "ingestion" ? 1.24 : stage === "resolution" ? 0.6 : 0.88;
  const lane = index % 5;
  const laneY = height * (0.18 + lane * 0.16);
  const laneX = stage === "ingestion" ? width * 0.14 : stage === "resolution" ? width * 0.78 : width * 0.5;
  const orbitRadius = clamp(58 + (1 - resonance) * 72 + density * 36 + (stage === "ingestion" ? 16 : 0), 48, 260);
  const drift = clamp((1 - stability) * 0.94 + (stage === "ingestion" ? 0.18 : 0), 0.04, 1.12);
  const weight = clamp(0.48 + resonance * 0.72 + density * 0.28, 0.28, 1.36);

  return {
    mass,
    density,
    resonance,
    temperature,
    stability,
    velocity,
    depth,
    flowMomentum,
    orbitRadius,
    drift,
    weight,
    stage,
    lane,
    laneX,
    laneY,
    flowSeed: seededUnit(node.id || node.title || index, index) * Math.PI * 2,
  };
}

function projectNodeDepth(node, width, height, focusState = {}) {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const distanceRatio = clamp(Math.hypot((node.x || centerX) - centerX, (node.y || centerY) - centerY) / Math.max(120, Math.hypot(centerX, centerY)), 0, 1);
  const depth = clamp(Number(node.depth || 0.5), 0, 1);
  const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
  const stability = clamp(Number(node.stability || 0.5), 0, 1);
  const temperature = clamp(Number(node.temperature || 0.5), 0, 1.5);
  const selectedBoost = focusState.isSelected ? 0.25 : focusState.isNeighbor ? 0.12 : focusState.isHovered ? 0.08 : 0;
  const scale = clamp(0.7 + depth * 0.78 + resonance * 0.22 + selectedBoost - distanceRatio * 0.14, 0.42, 2.2);
  const lift = Math.round((depth - 0.5) * 18 + stability * 6 - temperature * 7 + (focusState.isSelected ? 8 : 0));
  const blur = clamp((1 - depth) * 0.3 + temperature * 0.12 + distanceRatio * 0.12 - resonance * 0.14, 0.04, 0.92);

  return { scale, lift, blur, distanceRatio };
}

function projectNodeBody(node, focusState = {}) {
  const density = clamp(Number(node.density || node.semanticDensity || 0), 0, 1);
  const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
  const activity = clamp(Number(node.activity || node.semanticActivity || 0), 0, 1);
  const mass = clamp(Number(node.mass || 1), 0.72, 7.8);
  const stage = String(node.stage || "condensation");
  const selectedBoost = focusState.isSelected ? 0.22 : focusState.isNeighbor ? 0.08 : focusState.isHovered ? 0.05 : 0;
  const baseWidth = Math.max(80, Number(node.layoutWidth || 220));
  const baseHeight = Math.max(34, baseWidth * (0.15 + density * 0.16));
  const width = baseWidth * (0.66 + resonance * 0.88 + activity * 0.12 + selectedBoost);
  const height = baseHeight * (0.84 + resonance * 0.28 + mass * 0.04 + (stage === "resolution" ? 0.12 : 0));
  const squash = clamp(1 - (node.distanceRatio || 0) * 0.2 + resonance * 0.14 + (stage === "resolution" ? 0.1 : 0), 0.58, 1.28);
  const haloWidth = width * (1.16 + activity * 0.12 + (focusState.isSelected ? 0.16 : 0));
  const haloHeight = height * (1.3 + activity * 0.16 + (focusState.isSelected ? 0.12 : 0));
  const coreWidth = width * (0.44 + resonance * 0.28);
  const coreHeight = height * (0.38 + resonance * 0.2);

  return {
    width,
    height: height * squash,
    haloWidth,
    haloHeight,
    coreWidth,
    coreHeight,
    mass,
    density,
    resonance,
    activity,
    stability: clamp(Number(node.stability || 0.5), 0, 1),
  };
}

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
    element.setAttribute(key, String(value));
  }
}

function createNodeVisual(nodeId, handlers = {}) {
  // Render nodes as subtle yellow mesh elements in the background
  const group = createSvgElement("g", { "data-node-id": nodeId, style: "pointer-events:none" });
  const wake = createSvgElement("path", { fill: "none", pointerEvents: "none" });
  const orbit = createSvgElement("ellipse", { cx: 0, cy: 0, fill: "none", stroke: "#c9a227", "stroke-opacity": 0.08, pointerEvents: "none" });
  const halo = createSvgElement("ellipse", { cx: 0, cy: 0, fill: "none", stroke: "#c9a227", "stroke-opacity": 0.06, pointerEvents: "none" });
  const body = createSvgElement("ellipse", { cx: 0, cy: 0, fill: "none", stroke: "#c9a227", "stroke-opacity": 0.09, pointerEvents: "none" });
  const core = createSvgElement("ellipse", { cx: 0, cy: 0, fill: "none", stroke: "#c9a227", "stroke-opacity": 0.12, pointerEvents: "none" });
  const label = createSvgElement("text", { x: 0, y: 0, "text-anchor": "middle", "dominant-baseline": "middle", pointerEvents: "none", "font-family": "inherit", fill: "#c9a227", "fill-opacity": 0.08 });
  const meta = createSvgElement("text", { x: 0, y: 0, "text-anchor": "middle", "dominant-baseline": "middle", pointerEvents: "none", "font-family": "inherit", fill: "#c9a227", "fill-opacity": 0.06 });
  const particles = [0, 1, 2, 3].map(() => createSvgElement("circle", { cx: 0, cy: 0, fill: "#c9a227", "fill-opacity": 0.06, pointerEvents: "none" }));

  group.append(wake, orbit, halo, body, core, ...particles, label, meta);

  // Node interactions are disabled for the background mesh

  return { group, wake, orbit, halo, body, core, label, meta, particles };
}

function createLinkVisual() {
  return createSvgElement("path", {
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pointerEvents: "none",
    stroke: "#c9a227",
    "stroke-opacity": 0.06,
    markerEnd: "url(#relation-arrow)",
  });
}

function createFlowForce(sceneRef) {
  let nodes = [];

  const force = (alpha) => {
    const scene = sceneRef.current;
    const width = scene.width || 960;
    const height = scene.height || 560;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    for (const node of nodes) {
      const stage = node.stage || inferNodeStage(node);
      const flowMomentum = Number(node.flowMomentum || 0.8);
      const temperature = clamp(Number(node.temperature || 0.5), 0, 1.5);
      const mass = clamp(Number(node.mass || 1), 0.72, 7.8);
      const laneWave = Math.sin((scene.tickTime || performance.now()) * 0.00022 + Number(node.flowSeed || 0)) * 10;
      const targetX = stage === "ingestion" ? width * 0.12 : stage === "resolution" ? width * 0.82 : centerX + Math.sin(Number(node.flowSeed || 0)) * 26;
      const targetY = stage === "ingestion" ? height * (0.18 + (node.lane || 0) * 0.16) : stage === "resolution" ? height * (0.28 + (node.lane || 0) * 0.11) : centerY + laneWave;
      const dx = targetX - (node.x || centerX);
      const dy = targetY - (node.y || centerY);
      const push = alpha * (0.018 + temperature * 0.014 + flowMomentum * 0.01);

      node.vx += dx * push * 0.018;
      node.vy += dy * push * 0.018;
      node.vx += (stage === "ingestion" ? 0.08 : stage === "resolution" ? 0.01 : 0) * alpha;
      node.vy += Math.sin(Number(node.flowSeed || 0) + (scene.tickTime || performance.now()) * 0.00035) * alpha * 0.01;
      node.vx -= node.vx * (0.02 + mass * 0.003);
      node.vy -= node.vy * (0.016 + mass * 0.0025);
    }
  };

  force.initialize = (value) => {
    nodes = value || [];
  };

  return force;
}

function createVortexForce(sceneRef) {
  let nodes = [];

  const force = (alpha) => {
    const scene = sceneRef.current;
    const width = scene.width || 960;
    const height = scene.height || 560;
    const focusId = scene.selectedNodeId || scene.hoveredNodeId || null;
    const focusNode = focusId ? nodes.find((candidate) => candidate.id === focusId) : null;
    const centerX = focusNode?.x ?? width * 0.54;
    const centerY = focusNode?.y ?? height * 0.5;

    for (const node of nodes) {
      if (focusNode && node.id === focusNode.id) {
        continue;
      }

      const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
      const stability = clamp(Number(node.stability || 0.5), 0, 1);
      const orbitRadius = clamp(Number(node.orbitRadius || 120), 48, 260);
      const dx = (node.x || centerX) - centerX;
      const dy = (node.y || centerY) - centerY;
      const distance = Math.max(24, Math.hypot(dx, dy));
      const attraction = clamp((1.04 - resonance) * 0.012 + (1 - stability) * 0.004, 0.004, 0.02);
      const radial = alpha * attraction * (distance > orbitRadius ? 1.1 : 0.48);
      const tangentX = (-dy / distance) * alpha * (0.012 + resonance * 0.008);
      const tangentY = (dx / distance) * alpha * (0.012 + resonance * 0.008);

      node.vx += -dx * radial + tangentX;
      node.vy += -dy * radial + tangentY;
    }
  };

  force.initialize = (value) => {
    nodes = value || [];
  };

  return force;
}

function createCondensationForce(sceneRef) {
  let nodes = [];

  const force = (alpha) => {
    const scene = sceneRef.current;
    const width = scene.width || 960;
    const height = scene.height || 560;
    const attractors = nodes
      .filter((node) => Number(node.resonance || node.theoryResonanceScore || 0) >= 0.58 || node.stage === "resolution" || node.id === "theory-core-actional-space")
      .sort((left, right) => (right.resonance || right.theoryResonanceScore || 0) - (left.resonance || left.theoryResonanceScore || 0))
      .slice(0, 6);

    for (const node of nodes) {
      const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
      const stability = clamp(Number(node.stability || 0.5), 0, 1);
      if (resonance >= 0.72 || !attractors.length) {
        continue;
      }

      let target = attractors[0];
      let targetDistance = Number.POSITIVE_INFINITY;
      for (const candidate of attractors) {
        if (candidate.id === node.id) {
          continue;
        }

        const distance = Math.hypot((candidate.x || width * 0.5) - (node.x || width * 0.5), (candidate.y || height * 0.5) - (node.y || height * 0.5));
        if (distance < targetDistance) {
          targetDistance = distance;
          target = candidate;
        }
      }

      const dx = (target?.x ?? width * 0.5) - (node.x || width * 0.5);
      const dy = (target?.y ?? height * 0.5) - (node.y || height * 0.5);
      const pull = alpha * clamp(0.006 + (1 - resonance) * 0.015 + (1 - stability) * 0.004, 0.004, 0.026);

      node.vx += dx * pull;
      node.vy += dy * pull;
    }
  };

  force.initialize = (value) => {
    nodes = value || [];
  };

  return force;
}

function createDriftForce(sceneRef) {
  let nodes = [];

  const force = (alpha) => {
    const scene = sceneRef.current;
    const width = scene.width || 960;
    const height = scene.height || 560;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    for (const node of nodes) {
      const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
      const stability = clamp(Number(node.stability || 0.5), 0, 1);
      const temperature = clamp(Number(node.temperature || 0.5), 0, 1.5);
      const drift = clamp(Number(node.drift || 0.35), 0.04, 1.12);
      const weakness = clamp(1 - resonance * 0.9 - stability * 0.2, 0, 1);

      if (weakness <= 0.08) {
        continue;
      }

      const awayX = (node.x || centerX) - centerX;
      const awayY = (node.y || centerY) - centerY;
      const spread = alpha * (0.002 + weakness * 0.006 + temperature * 0.002);
      node.vx += awayX * spread + Math.sin(Number(node.flowSeed || 0) + (scene.tickTime || performance.now()) * 0.0002) * alpha * 0.002 * drift;
      node.vy += awayY * spread + Math.cos(Number(node.flowSeed || 0) + (scene.tickTime || performance.now()) * 0.00017) * alpha * 0.002 * drift;
      node.vx -= node.vx * weakness * 0.01;
      node.vy -= node.vy * weakness * 0.01;
    }
  };

  force.initialize = (value) => {
    nodes = value || [];
  };

  return force;
}

function createTheoryGravityForce(sceneRef) {
  let nodes = [];

  const force = (alpha) => {
    const scene = sceneRef.current;
    const width = scene.width || 960;
    const height = scene.height || 560;
    const now = performance.now();
    const pulse = scene.interactionPulseUntil && scene.interactionPulseUntil > now ? 1.9 : 1;

    for (const node of nodes) {
      const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
      const stability = clamp(Number(node.stability || 0.5), 0, 1);
      const stage = node.stage || inferNodeStage(node);
      const targetX = stage === "resolution" || resonance > 0.58 ? width * 0.82 : stage === "ingestion" ? width * 0.3 : width * 0.64;
      const targetY = height * (0.28 + (node.lane || 0) * 0.12);
      const gravity = clamp(0.006 + resonance * 0.014 + stability * 0.004, 0.004, 0.024) * pulse;

      node.vx += (targetX - (node.x || width * 0.5)) * alpha * gravity;
      node.vy += (targetY - (node.y || height * 0.5)) * alpha * (gravity * 0.62);
    }
  };

  force.initialize = (value) => {
    nodes = value || [];
  };

  return force;
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
  const meshLayerRef = useRef(null);
  const meshElementsRef = useRef(new Map());
  const tensionElementsRef = useRef(new Map());
  const nodeElementsRef = useRef(new Map());
  const linkElementsRef = useRef(new Map());
  const sceneRef = useRef({
    nodes: [],
    links: [],
    width: 0,
    height: 0,
    selectedNodeId: null,
    hoveredNodeId: null,
    activityMap: new Map(),
    neighborIds: new Set(),
    tickTime: performance.now(),
    interactionPulseUntil: 0,
  });
  const renderSceneRef = useRef(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  const actions = useMemo(() => createGraphActions(effectiveStore), [effectiveStore]);

  useEffect(() => {
    let active = true;
    let frameId = 0;

    const resize = () => {
      const el = containerRef.current;
      if (!el) {
        return;
      }

      const rect = el.getBoundingClientRect();
      actions.setViewport({ width: Math.max(320, Math.floor(rect.width)), height: Math.max(240, Math.floor(rect.height)), dpr: window.devicePixelRatio || 1 });
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const tick = (now) => {
      if (!active) {
        return;
      }

      sceneRef.current.tickTime = now;
      try {
        actions.tick(now);
      } catch (error) {
        console.error("Tick error:", error);
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
    const marker = createSvgElement("marker", { id: "relation-arrow", markerWidth: 8, markerHeight: 8, refX: 7, refY: 3.5, orient: "auto", markerUnits: "strokeWidth" });
    marker.appendChild(createSvgElement("path", { d: "M0,0 L0,7 L7,3.5 z", fill: "#ffffff", "fill-opacity": 0.78 }));

    const glow = createSvgElement("filter", { id: "relation-soft-glow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    glow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: 1.1, result: "blur" }));
    glow.appendChild(createSvgElement("feColorMatrix", { in: "blur", type: "matrix", values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0" }));

    const nodeBodyGradient = createSvgElement("radialGradient", { id: "node-body-gradient", cx: "42%", cy: "35%", r: "72%" });
    nodeBodyGradient.append(
      createSvgElement("stop", { offset: "0%", "stop-color": "#fffaf2", "stop-opacity": 0.96 }),
      createSvgElement("stop", { offset: "48%", "stop-color": "#f4e6ca", "stop-opacity": 0.92 }),
      createSvgElement("stop", { offset: "100%", "stop-color": "#d6be8b", "stop-opacity": 0.72 }),
    );

    const nodeCoreGradient = createSvgElement("radialGradient", { id: "node-core-gradient", cx: "48%", cy: "42%", r: "68%" });
    nodeCoreGradient.append(
      createSvgElement("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": 1 }),
      createSvgElement("stop", { offset: "72%", "stop-color": "#f8f0df", "stop-opacity": 0.92 }),
      createSvgElement("stop", { offset: "100%", "stop-color": "#f0e0c2", "stop-opacity": 0.7 }),
    );

    const nodeHaloGradient = createSvgElement("radialGradient", { id: "node-halo-gradient", cx: "50%", cy: "48%", r: "78%" });
    nodeHaloGradient.append(
      createSvgElement("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": 0.24 }),
      createSvgElement("stop", { offset: "55%", "stop-color": "#f6ead7", "stop-opacity": 0.12 }),
      createSvgElement("stop", { offset: "100%", "stop-color": "#f6ead7", "stop-opacity": 0 }),
    );

    defs.append(marker, glow, nodeBodyGradient, nodeCoreGradient, nodeHaloGradient);

    const linksLayer = createSvgElement("g", { class: "edge-layer-root" });
    const meshLayer = createSvgElement("g", { class: "mesh-layer-root" });
    const nodesLayer = createSvgElement("g", { class: "node-layer-root" });
    svg.append(defs, linksLayer, meshLayer, nodesLayer);
    linksLayerRef.current = linksLayer;
    meshLayerRef.current = meshLayer;
    nodesLayerRef.current = nodesLayer;

    const centerForce = forceCenter(0, 0);
    const linkForce = forceLink([])
      .id((node) => node.id)
      .distance((edge) => {
        const sourceMass = Number(edge.sourceNode?.mass || edge.targetNode?.mass || 1);
        const strength = Number(edge.semanticStrength ?? edge.score ?? edge.weight ?? 0);
        const stageBias = edge.sourceNode?.stage === "resolution" || edge.targetNode?.stage === "resolution" ? -22 : 0;
        return clamp(126 + sourceMass * 12 - strength * 42 + stageBias, 62, 320);
      })
      .strength((edge) => {
        const confidence = Number(edge.confidence || edge.semanticStrength || edge.score || edge.weight || 0);
        return clamp(0.08 + confidence * 0.18, 0.06, 0.36);
      });

    const collisionForce = forceCollide()
      .radius((node) => {
        const body = projectNodeBody(node);
        return Math.max(36, body.width * 0.24 + body.mass * 0.8);
      })
      .iterations(2);

    const simulation = forceSimulation([])
      .force("center", centerForce)
      .force("link", linkForce)
      .force("charge", forceManyBody().strength((node) => {
        const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
        const mass = clamp(Number(node.mass || 1), 0.72, 7.8);
        const stability = clamp(Number(node.stability || 0.5), 0, 1);
        return -(42 + mass * 20 + resonance * 22 + stability * 10);
      }))
      .force("collision", collisionForce)
      .force("flow", createFlowForce(sceneRef))
      .force("vortex", createVortexForce(sceneRef))
      .force("condensation", createCondensationForce(sceneRef))
      .force("drift", createDriftForce(sceneRef))
      .force("gravity", createTheoryGravityForce(sceneRef))
      .velocityDecay(0.58)
      .alphaDecay(0.015)
      .alphaMin(0.001);

    simulation.on("tick", () => {
      renderSceneRef.current?.();
    });

    simulationRef.current = simulation;
    centerForceRef.current = centerForce;
    linkForceRef.current = linkForce;
    collisionForceRef.current = collisionForce;
    linksLayerRef.current = linksLayer;
    meshLayerRef.current = meshLayer;
    nodesLayerRef.current = nodesLayer;
    nodeElementsRef.current.clear();
    linkElementsRef.current.clear();
    meshElementsRef.current.clear();
    tensionElementsRef.current.clear();
    nodeElementsRef.current = new Map();
    linkElementsRef.current = new Map();

    const cleanupHover = () => {
      sceneRef.current.hoveredNodeId = null;
    };
    svg.addEventListener("pointerleave", cleanupHover);

    return () => {
      svg.removeEventListener("pointerleave", cleanupHover);
      simulation.stop();
      simulationRef.current = null;
      centerForceRef.current = null;
      linkForceRef.current = null;
      collisionForceRef.current = null;
      nodesLayerRef.current = null;
      linksLayerRef.current = null;
      meshLayerRef.current = null;
      nodeElementsRef.current.clear();
      linkElementsRef.current.clear();
      meshElementsRef.current.clear();
      tensionElementsRef.current.clear();
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
        const morphology = deriveNodeMorphology({ ...snapshot, id: nodeId }, clamp(snapshot.semanticActivity || 0, 0, 1), width, height, index);
        const fallbackAngle = (index / Math.max(1, sourceNodes.length)) * Math.PI * 2;
        const fallbackRadius = Math.min(width, height) * 0.24;
        const nextX = Number.isFinite(snapshot.x)
          ? snapshot.x
          : morphology.stage === "ingestion"
            ? width * 0.14 + Math.cos(fallbackAngle) * fallbackRadius * 0.28
            : morphology.stage === "resolution"
              ? width * 0.8 + Math.cos(fallbackAngle) * fallbackRadius * 0.14
              : width * 0.5 + Math.cos(fallbackAngle) * fallbackRadius;
        const nextY = Number.isFinite(snapshot.y) ? snapshot.y : morphology.laneY + Math.sin(fallbackAngle) * fallbackRadius * 0.14;
        const baseNode = {
          ...snapshot,
          id: nodeId,
          x: nextX,
          y: nextY,
          vx: Number.isFinite(snapshot.vx) ? snapshot.vx : 0,
          vy: Number.isFinite(snapshot.vy) ? snapshot.vy : 0,
        };

        if (existing) {
          Object.assign(existing, baseNode, morphology, {
            semanticPhysics: snapshot.semanticPhysics || existing.semanticPhysics || {},
            fragments: snapshot.fragments || existing.fragments || collectNodeFragments(baseNode).fragments,
          });
          return existing;
        }

        return {
          ...baseNode,
          ...morphology,
          semanticPhysics: snapshot.semanticPhysics || {},
          fragments: snapshot.fragments || collectNodeFragments(baseNode).fragments,
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
        ...sceneRef.current,
        nodes: mergedNodes,
        links: mergedLinks,
        width,
        height,
        selectedNodeId,
        activityMap,
        neighborIds,
      };

      // --- Architectural mesh generation (nearest-neighbor lines + tension curves)
      try {
        const meshMap = new Map();
        const maxNeighbors = 6;
        const nodesArr = mergedNodes;
        for (let i = 0; i < nodesArr.length; i++) {
          const a = nodesArr[i];
          const neighbors = nodesArr
            .filter((n) => n.id !== a.id)
            .map((n) => ({ n, d: Math.hypot((n.x || 0) - (a.x || 0), (n.y || 0) - (a.y || 0)) }))
            .sort((l, r) => l.d - r.d)
            .slice(0, maxNeighbors);

          for (const nb of neighbors) {
            const id1 = String(a.id);
            const id2 = String(nb.n.id);
            const key = id1 < id2 ? `${id1}::${id2}` : `${id2}::${id1}`;
            if (!meshMap.has(key)) {
              meshMap.set(key, { a, b: nb.n, dist: nb.d });
            }
          }
        }

        // Create new mesh lines
        for (const [key, seg] of meshMap.entries()) {
          if (!meshElementsRef.current.has(key)) {
            const line = createSvgElement("line", {
              "data-mesh": key,
              stroke: "#222",
              "stroke-opacity": 0.04,
              "stroke-width": 0.6,
              "vector-effect": "non-scaling-stroke",
              "pointer-events": "none",
            });
            meshElementsRef.current.set(key, line);
            meshLayerRef.current?.appendChild(line);
          }
        }

        // Remove stale mesh lines
        for (const oldKey of Array.from(meshElementsRef.current.keys())) {
          if (!meshMap.has(oldKey)) {
            const el = meshElementsRef.current.get(oldKey);
            el.remove();
            meshElementsRef.current.delete(oldKey);
          }
        }

        // Update positions with gentle breathing and depth
        for (const [key, el] of meshElementsRef.current.entries()) {
          const [idA, idB] = key.split("::");
          const a = mergedNodes.find((n) => String(n.id) === idA);
          const b = mergedNodes.find((n) => String(n.id) === idB);
          if (!a || !b) continue;
          const breath = Math.sin((sceneRef.current.tickTime || performance.now()) * 0.00035 + (hashString(key) % 100) * 0.01) * 2.4;
          const ax = (a.x || 0) + breath * (0.28 + (Number(a.resonance || 0) * 0.6));
          const bx = (b.x || 0) - breath * (0.28 + (Number(b.resonance || 0) * 0.6));
          el.setAttribute("x1", String(ax));
          el.setAttribute("y1", String(a.y || 0));
          el.setAttribute("x2", String(bx));
          el.setAttribute("y2", String(b.y || 0));
          const avgRes = (Number(a.resonance || 0) + Number(b.resonance || 0)) / 2;
          const dist = Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
          const opacity = clamp(0.02 + avgRes * 0.05 + (1 - clamp(dist / 420, 0, 1)) * 0.03, 0.01, 0.12);
          el.setAttribute("stroke-opacity", String(opacity.toFixed(3)));
          el.setAttribute("stroke-width", String((0.28 + avgRes * 0.6).toFixed(2)));
        }
      } catch (err) {
        console.warn("Mesh generation error:", err);
      }

      // Create curved tension lines for strong semantic relations
      try {
        const tensionThreshold = 0.48;
        const strongEdges = mergedLinks.filter((e) => (Number(e.semanticStrength || e.score || 0) >= tensionThreshold) || (Number(e.confidence || 0) >= 0.45));

        for (const edge of strongEdges) {
          const key = `tension::${edge.id}`;
          if (!tensionElementsRef.current.has(key)) {
            const path = createSvgElement("path", {
              fill: "none",
              stroke: "#111",
              "stroke-opacity": 0.06,
              "stroke-width": 0.8,
              "pointer-events": "none",
              "vector-effect": "non-scaling-stroke",
            });
            tensionElementsRef.current.set(key, path);
            meshLayerRef.current?.appendChild(path);
          }
        }

        for (const oldKey of Array.from(tensionElementsRef.current.keys())) {
          const edgeId = oldKey.replace(/^tension::/, "");
          if (!mergedLinks.some((e) => String(e.id) === edgeId && ((Number(e.semanticStrength || e.score || 0) >= tensionThreshold) || (Number(e.confidence || 0) >= 0.45)))) {
            const el = tensionElementsRef.current.get(oldKey);
            el.remove();
            tensionElementsRef.current.delete(oldKey);
          }
        }

        for (const [key, pathEl] of tensionElementsRef.current.entries()) {
          const edgeId = key.replace(/^tension::/, "");
          const edge = mergedLinks.find((e) => String(e.id) === edgeId);
          if (!edge) continue;
          const s = edge.sourceNode || edge.source || {};
          const t = edge.targetNode || edge.target || {};
          const sx = s.x || 0;
          const sy = s.y || 0;
          const tx = t.x || 0;
          const ty = t.y || 0;
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const normalX = -dy / dist;
          const normalY = dx / dist;
          const strength = clamp(Number(edge.semanticStrength || edge.score || edge.confidence || 0), 0, 1);
          const offset = 8 + strength * 28;
          const cx = mx + normalX * offset * (0.6 + Math.sin((sceneRef.current.tickTime || performance.now()) * 0.0006 + (hashString(edge.id || edge.source || edge.target) % 100) * 0.01) * 0.28);
          const cy = my + normalY * offset * (0.6 + Math.cos((sceneRef.current.tickTime || performance.now()) * 0.0005 + (hashString(edge.id || edge.source || edge.target) % 100) * 0.01) * 0.28);
          const d = `M ${sx},${sy} Q ${cx},${cy} ${tx},${ty}`;
          pathEl.setAttribute("d", d);
          const opacity = clamp(0.02 + strength * 0.08, 0.02, 0.18);
          pathEl.setAttribute("stroke-opacity", String(opacity.toFixed(3)));
          pathEl.setAttribute("stroke-width", String((0.6 + strength * 1.2).toFixed(2)));
        }
      } catch (err) {
        console.warn("Tension update error:", err);
      }

      mergedNodes.forEach((node) => {
        if (!nodeElementsRef.current.has(node.id)) {
          const visual = createNodeVisual(node.id, {
            onHover: (nodeId) => {
              sceneRef.current.hoveredNodeId = nodeId;
              simulation.alphaTarget(0.18).restart();
            },
            onUnhover: (nodeId) => {
              if (sceneRef.current.hoveredNodeId === nodeId) {
                sceneRef.current.hoveredNodeId = null;
              }
            },
            onSelect: (nodeId) => {
              const selectedNode = nodeLookup.get(nodeId);
              onNodeSelectRef.current?.({ ...selectedNode, id: nodeId, nodeId });
            },
            onActivate: () => {
              sceneRef.current.interactionPulseUntil = performance.now() + 1200;
              simulation.alphaTarget(0.3).restart();
            },
          });
          nodeElementsRef.current.set(node.id, visual);
          nodeElementsRef.current = new Map(nodeElementsRef.current);
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
        const body = projectNodeBody(node);
        return Math.max(36, body.width * 0.22 + body.mass * 0.78);
      });
      simulation.nodes(mergedNodes);
      simulation.alphaTarget(selectedNodeId ? 0.18 : 0.06).restart();

      renderSceneRef.current = () => {
        const { nodes, links, selectedNodeId: currentSelectedNodeId, hoveredNodeId: currentHoveredNodeId, neighborIds: currentNeighborIds, activityMap: currentActivityMap, width: currentWidth, height: currentHeight, tickTime } = sceneRef.current;
        const nodeLookupNow = new Map(nodes.map((node) => [node.id, node]));
        const focusNodeId = currentSelectedNodeId || currentHoveredNodeId || null;

        for (const node of nodes) {
          const visual = nodeElementsRef.current.get(node.id);
          if (!visual) {
            continue;
          }

          const activity = clamp((currentActivityMap.get(node.id) || 0) / 3.2, 0, 1);
          const focusState = {
            isSelected: currentSelectedNodeId && node.id === currentSelectedNodeId,
            isHovered: currentHoveredNodeId && node.id === currentHoveredNodeId,
            isNeighbor: focusNodeId && currentNeighborIds.has(node.id),
          };
          const depthState = projectNodeDepth({ ...node, activity }, currentWidth, currentHeight, focusState);
          const body = projectNodeBody({ ...node, activity, distanceRatio: depthState.distanceRatio }, focusState);
          const fragments = collectNodeFragments(node);
          const resonance = clamp(Number(node.resonance || node.theoryResonanceScore || 0), 0, 1);
          const stage = String(node.stage || inferNodeStage(node));
          const opacity = clamp((node.atmosphericOpacity ?? node.opacity ?? 0.84) * (focusState.isSelected ? 1 : focusState.isNeighbor ? 0.96 : focusState.isHovered ? 0.9 : resonance < 0.22 ? 0.58 : 0.9), 0.04, 1);
          const depthScale = clamp(depthState.scale + (focusState.isSelected ? 0.22 : focusState.isHovered ? 0.1 : 0), 0.42, 2.3);
          const x = node.x || 0;
          const y = (node.y || 0) + depthState.lift;

          setSvgElementAttributes(visual.group, {
            transform: `translate(${x}, ${y}) scale(${depthScale})`,
            opacity,
            "data-selected": focusState.isSelected ? "true" : "false",
            "data-neighbor": focusState.isNeighbor ? "true" : "false",
            "data-hovered": focusState.isHovered ? "true" : "false",
            "data-stage": stage,
          });

          setSvgElementAttributes(visual.wake, {
            d: `M ${-body.width * 0.64} ${body.height * 0.05} C ${-body.width * 0.36} ${-body.height * (0.14 + body.activity * 0.08)}, ${-body.width * 0.1} ${body.height * (0.1 + body.activity * 0.06)}, ${body.width * 0.56} ${body.height * 0.08}`,
            stroke: "#fff7ea",
            strokeOpacity: clamp(0.08 + body.stability * 0.08 + (focusState.isSelected ? 0.1 : 0), 0.04, 0.3),
            strokeWidth: clamp(0.8 + body.mass * 0.06, 0.6, 1.6),
            style: `filter: blur(${clamp(depthState.blur * 1.1, 0.03, 0.9)}px);`,
          });

          setSvgElementAttributes(visual.orbit, {
            rx: body.width ? body.width * 0.62 : Math.max(58, (node.layoutWidth || 220) * 0.34),
            ry: body.height ? body.height * 0.72 : Math.max(24, (node.layoutWidth || 220) * 0.1),
            stroke: focusState.isSelected ? "#f6f0e7" : focusState.isNeighbor ? "#ddcfb0" : "#ffffff",
            strokeOpacity: focusState.isSelected ? 0.34 : focusState.isNeighbor ? 0.2 : 0.08,
            strokeWidth: focusState.isSelected ? 1.8 : focusState.isNeighbor ? 1.3 : 0.8,
            strokeDasharray: resonance < 0.28 ? "4 8" : null,
            style: `filter: blur(${clamp(depthState.blur * 0.6, 0.02, 0.4)}px);`,
          });

          setSvgElementAttributes(visual.halo, {
            rx: body.haloWidth ? body.haloWidth * 0.5 : Math.max(52, (node.layoutWidth || 220) * 0.32),
            ry: body.haloHeight ? body.haloHeight * 0.5 : Math.max(26, (node.layoutWidth || 220) * 0.11),
            fill: "url(#node-halo-gradient)",
            fillOpacity: clamp(0.1 + body.activity * 0.12 + (focusState.isSelected ? 0.08 : 0), 0.04, 0.32),
            stroke: "#f6f0e7",
            strokeOpacity: focusState.isSelected ? 0.18 : 0.08,
            strokeWidth: 1,
            style: `filter: blur(${clamp(depthState.blur * 1.6, 0.03, 0.9)}px);`,
          });

          setSvgElementAttributes(visual.body, {
            rx: body.width ? body.width * 0.5 : Math.max(34, (node.layoutWidth || 220) * 0.22),
            ry: body.height ? body.height * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.07),
            fill: node.id === "theory-core-actional-space" ? "#f4d37a" : "url(#node-body-gradient)",
            fillOpacity: clamp(0.14 + body.resonance * 0.68 + body.activity * 0.14 + (focusState.isSelected ? 0.18 : focusState.isNeighbor ? 0.08 : 0), 0.08, 1),
            stroke: "#ffffff",
            strokeOpacity: clamp(0.08 + body.density * 0.24, 0.04, 0.4),
            strokeWidth: clamp(0.72 + body.mass * 0.14 + (focusState.isSelected ? 0.2 : 0), 0.7, 2.3),
          });

          setSvgElementAttributes(visual.core, {
            rx: body.coreWidth ? body.coreWidth * 0.5 : Math.max(18, (node.layoutWidth || 220) * 0.12),
            ry: body.coreHeight ? body.coreHeight * 0.5 : Math.max(8, (node.layoutWidth || 220) * 0.04),
            fill: "url(#node-core-gradient)",
            fillOpacity: clamp(0.14 + body.resonance * 0.42 + (focusState.isSelected ? 0.16 : 0), 0.08, 0.92),
            style: `filter: blur(${clamp(depthState.blur * 0.42, 0.01, 0.26)}px);`,
          });

          const orbitSeed = tickTime * 0.00035 + Number(node.flowSeed || 0);
          visual.particles.forEach((particle, particleIndex) => {
            const angle = orbitSeed + particleIndex * 1.7;
            setSvgElementAttributes(particle, {
              cx: Math.cos(angle) * (body.width || 40) * (0.18 + particleIndex * 0.02 + (focusState.isSelected ? 0.04 : 0)),
              cy: Math.sin(angle) * (body.height || 18) * (0.24 + particleIndex * 0.03 + (focusState.isSelected ? 0.06 : 0)),
              r: 1.1 + body.activity * 1.1 + (focusState.isSelected ? 0.5 : 0),
              fill: "#ffffff",
              fillOpacity: clamp(0.14 + body.activity * 0.38 + (focusState.isSelected ? 0.2 : 0), 0.08, 0.92),
            });
          });

          const labelFontSize = clamp(10 + body.resonance * 4 + body.activity * 2 + (focusState.isSelected ? 2 : 0), 10, 17);
          const metaFontSize = clamp(labelFontSize * 0.66, 8, 11);

          setSvgElementAttributes(visual.label, {
            x: 0,
            y: -body.height * 0.04,
            fill: "#fffaf2",
            opacity: clamp(0.45 + body.resonance * 0.44 + (focusState.isSelected ? 0.22 : 0) + (focusState.isNeighbor ? 0.12 : 0), 0.18, 1),
            "font-size": `${labelFontSize}px`,
            "letter-spacing": "0.03em",
            "font-weight": 600,
          });
          visual.label.textContent = fragments.primary;

          setSvgElementAttributes(visual.meta, {
            x: 0,
            y: body.height * 0.2,
            fill: "#e6d6b8",
            opacity: clamp(0.2 + body.stability * 0.32 + (focusState.isSelected ? 0.18 : 0), 0.12, 0.96),
            "font-size": `${metaFontSize}px`,
            "letter-spacing": "0.08em",
            "font-weight": 500,
          });
          visual.meta.textContent = fragments.secondary || [stage, body.mass > 3 ? "heavy" : "light"].filter(Boolean).join(" · ");
        }

        for (const [edgeId, visual] of linkElementsRef.current.entries()) {
          const edge = links.find((candidate) => candidate.id === edgeId);
          if (!edge) {
            continue;
          }

          const left = nodeLookupNow.get(edge.source?.id || edge.sourceNode?.id || edge.source);
          const right = nodeLookupNow.get(edge.target?.id || edge.targetNode?.id || edge.target);
          if (!left || !right) {
            continue;
          }

          const semanticStrength = edge.semanticStrength ?? edge.score ?? edge.weight ?? 0;
          const selectedEdge = focusNodeId && (left.id === focusNodeId || right.id === focusNodeId);
          const depthSpan = Math.abs((left.depth || 0.5) - (right.depth || 0.5));
          const midpointX = (left.x + right.x) * 0.5;
          const midpointY = (left.y + right.y) * 0.5;
          const dx = right.x - left.x;
          const dy = right.y - left.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / distance;
          const ny = dx / distance;
          const tension = clamp(0.04 + semanticStrength * 0.12 + depthSpan * 0.08 + Math.min(0.26, (edge.confidence || 0) * 0.18), 0.04, 0.56);
          const curveX = midpointX + nx * distance * tension;
          const curveY = midpointY + ny * distance * tension * 0.74;
          const breathing = 0.65 + Math.sin(tickTime * 0.0018 + hashString(edge.id || edge.source?.id || edge.target?.id)) * 0.18;

          setSvgElementAttributes(visual, {
            d: `M ${left.x} ${left.y} Q ${curveX} ${curveY} ${right.x} ${right.y}`,
            stroke: edge.type === "wiki" || edge.type === "theory" ? "#c9a227" : "#ffffff",
            strokeOpacity: Math.min(0.98, Math.max(0.04, (edge.opacity ?? 0.06) + Math.min(0.52, semanticStrength * 0.26) + Math.min(0.24, (edge.confidence || 0) * 0.2) + (selectedEdge ? 0.24 : 0) - (focusNodeId && !selectedEdge ? 0.16 : 0))),
            strokeWidth: Math.max(0.46, 0.52 + semanticStrength * 0.68 + Math.min(0.52, (edge.confidence || 0) * 0.4) + (selectedEdge ? 0.42 : 0)),
            strokeDasharray: semanticStrength < 0.24 ? "5 11" : null,
            strokeDashoffset: `${Math.round(tickTime * -0.03)}`,
            style: `filter: blur(${clamp(1.2 - semanticStrength * 0.32, 0.12, 1.38)}px); opacity:${breathing};`,
          });
        }
      };

      renderSceneRef.current();
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
      style: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 },
      width: "100%",
      height: "100%",
      viewBox: `0 0 960 560`,
    }),
  );
}
