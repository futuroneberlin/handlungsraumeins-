import { createCanvasStage } from "./core/canvas.js";
import { renderScene } from "./core/renderer.js";
import { createFoundationState } from "./core/layout.js";
import { updateFragments } from "./core/movement.js";
import { updateSpatialMemory } from "./core/spatialMemory.js";
import { createSemanticEdges, createEmergentCategories, updateRelationLayer } from "./core/relations.js";
import { graphState, loadGraphState, scheduleGraphStateSave } from "./core/graphState.js";
import { THEORY_CORE_TITLE, THEORY_CORE_TEXT, THEORY_CORE_KEYWORDS } from "./core/theoryModel.js";
import { loadTheoryCorpus, flattenLines } from "./modules/theoryLoader.js";
import { extractFoundationTerms } from "./modules/semanticExtractor.js";
import { fetchWikipediaEntry } from "./modules/wikipedia.js";

const WIKI_TOPICS = [
  "Art",
  "Kunst",
  "kunsttheorie",
  "bildhauerei",
  "sculpture",
  "Social Sculpture",
  "Joseph Beuys",
  "Space",
  "Architecture",
  "Society",
  "Action",
  "Movement",
  "Density",
  "Practice",
  "Art as Experience",
  "Art as Human Practice",
];

const THEORY_CORE_ID = "theory-core-actional-space";

const MAX_FEED_LINES = 72;
const FEED_INTERVAL = 420;
const EXTRACTION_INTERVAL = 2600;
const RELATION_INTERVAL = 4200;
const WIKI_INTERVAL = 7500;

const canvas = document.getElementById("scene");
const stageShell = document.querySelector(".stage-shell");
const ingestionPanel = document.getElementById("ingestion-panel");
const foundationPanel = document.getElementById("foundation-panel");

if (!canvas) {
  throw new Error("Canvas element not found.");
}

const stage = createCanvasStage(canvas);
const context = stage.context;
const state = graphState;

state.viewport = stage.getViewport();
state.corpus = state.corpus || [];
state.baseTerms = state.baseTerms || [];
state.termKeys = state.termKeys || new Set();
state.foundationState = state.foundationState || createFoundationState(stage.getViewport());
state.lastFrameAt = performance.now();
state.nextFeedAt = state.nextFeedAt || 0;
state.nextExtractionAt = state.nextExtractionAt || 0;
state.nextRelationAt = state.nextRelationAt || 0;
state.nextWikiAt = state.nextWikiAt || 0;
state.wikiCursor = state.wikiCursor || 0;
state.feedSpeed = state.feedSpeed || 16;
state.running = true;
state.nextTransformationAt = state.nextTransformationAt || 0;
state.hydrated = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return fallback;
    }
    return await response.json();
  } catch {
    return fallback;
  }
}

function buildFeedEntries(corpus) {
  return flattenLines(corpus).map((entry, index) => ({
    id: `feed-${index}-${normalizeKey(entry.text)}`,
    source: entry.source || "theory",
    text: entry.text,
    age: 0,
    opacity: 0.92,
    y: 0,
  }));
}

function mergeUniqueStrings(...values) {
  const merged = new Map();
  const stack = [...values];

  while (stack.length) {
    const value = stack.shift();
    if (Array.isArray(value)) {
      stack.unshift(...value);
      continue;
    }

    const text = String(value || "").trim();
    if (!text) {
      continue;
    }

    const key = normalizeKey(text) || text.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, text);
    }
  }

  return [...merged.values()];
}

function nodeIdentity(node) {
  return normalizeKey(node?.id || node?.wikiTitle || node?.keyword || node?.text || node?.title || "");
}

function upsertGraphNode(candidate) {
  if (!candidate) {
    return null;
  }

  const identity = nodeIdentity(candidate);
  const existingIndex = state.nodes.findIndex((node) => node.id === candidate.id || nodeIdentity(node) === identity);
  const now = performance.now();

  if (existingIndex === -1) {
    const node = {
      appearanceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      ...candidate,
      keywords: mergeUniqueStrings(candidate.keywords || [], candidate.wikiCategories || [], candidate.wikiLinks || [], candidate.keyword || candidate.text),
      wikiCategories: mergeUniqueStrings(candidate.wikiCategories || []),
      wikiLinks: mergeUniqueStrings(candidate.wikiLinks || []),
    };

    state.nodes.push(node);
    return node;
  }

  const existing = state.nodes[existingIndex];
  if (existing.id === THEORY_CORE_ID) {
    return existing;
  }

  const merged = {
    ...existing,
    ...candidate,
    id: existing.id || candidate.id,
    keywords: mergeUniqueStrings(existing.keywords || [], candidate.keywords || [], candidate.wikiCategories || [], candidate.wikiLinks || [], existing.keyword, existing.text),
    wikiCategories: mergeUniqueStrings(existing.wikiCategories || [], candidate.wikiCategories || []),
    wikiLinks: mergeUniqueStrings(existing.wikiLinks || [], candidate.wikiLinks || []),
    wikiSummary: candidate.wikiSummary || existing.wikiSummary || candidate.summary || existing.summary || "",
    wikiUrl: candidate.wikiUrl || existing.wikiUrl || candidate.url || existing.url || "",
    category: candidate.category || existing.category,
    semanticGroup: candidate.semanticGroup || existing.semanticGroup,
    role: candidate.role || existing.role,
    appearanceCount: (existing.appearanceCount || 1) + 1,
    lastSeenAt: now,
    firstSeenAt: existing.firstSeenAt || now,
    weight: Math.max(existing.weight || 0, candidate.weight || 0),
    mass: Math.max(existing.mass || 0, candidate.mass || 0),
    layoutWidth: Math.max(existing.layoutWidth || 0, candidate.layoutWidth || 0),
    targetX: Number.isFinite(candidate.targetX) ? candidate.targetX : existing.targetX,
    targetY: Number.isFinite(candidate.targetY) ? candidate.targetY : existing.targetY,
  };

  state.nodes[existingIndex] = merged;
  return merged;
}

function createWikipediaNode(entry) {
  const width = state.viewport.width || 1280;
  const height = state.viewport.height || 800;
  const categories = Array.isArray(entry.categories) ? entry.categories : [];
  const links = Array.isArray(entry.links) ? entry.links : [];
  const title = String(entry.title || entry.term || "Wikipedia Concept").trim();
  const summary = String(entry.summary || "").trim();
  const primaryCategory = categories[0] || "Wikipedia";
  const relevance = 1 + Math.min(1.2, categories.length * 0.08 + links.length * 0.01);

  return {
    id: `wiki-${normalizeKey(title)}`,
    text: title,
    keyword: title,
    title,
    source: title,
    wikiTitle: title,
    wikiSummary: summary,
    wikiUrl: entry.url || "",
    wikiCategories: categories,
    wikiLinks: links,
    keywords: mergeUniqueStrings([title], categories.slice(0, 6), links.slice(0, 10), summary.split(/\s+/).slice(0, 12)),
    category: primaryCategory,
    semanticGroup: primaryCategory,
    role: categories.length > 3 ? "central" : "secondary",
    phase: "ingestion",
    x: width * 0.12,
    y: height * (0.22 + ((state.nodes.length % 6) * 0.08)),
    targetX: width * 0.5,
    targetY: height * 0.46,
    anchorX: width * 0.5,
    anchorY: height * 0.46,
    clusterCenterX: width * 0.5,
    clusterCenterY: height * 0.46,
    depthLayer: 1,
    lane: 1,
    rowIndex: state.nodes.length,
    mass: relevance,
    weight: relevance,
    layoutWidth: Math.max(240, Math.min(360, width * 0.24)),
    sizeScale: 1,
    opacity: 0.94,
    memoryOpacity: 0.76,
    appearanceCount: 1,
    lastSeenAt: performance.now(),
    firstSeenAt: performance.now(),
  };
}

function createTheoryCoreNode(viewport) {
  const width = viewport.width || 1280;
  const height = viewport.height || 800;

  return {
    id: THEORY_CORE_ID,
    text: THEORY_CORE_TITLE,
    keyword: THEORY_CORE_TITLE,
    keywords: [...THEORY_CORE_KEYWORDS],
    category: "Theory Core",
    semanticGroup: "Theory",
    role: "central",
    phase: "foundation",
    x: width * 0.5,
    y: height * 0.46,
    targetX: width * 0.5,
    targetY: height * 0.46,
    anchorX: width * 0.5,
    anchorY: height * 0.46,
    clusterCenterX: width * 0.5,
    clusterCenterY: height * 0.46,
    depthLayer: 0,
    lane: 1,
    rowIndex: 0,
    mass: 2.8,
    weight: 2,
    opacity: 1,
    memoryOpacity: 1,
    layoutWidth: Math.max(320, width * 0.32),
    sizeScale: 1.55,
    isTheoryCore: true,
    locked: true,
    fixed: true,
    stable: true,
    age: 0,
  };
}

function ensureTheoryCoreNode() {
  const existingIndex = state.nodes.findIndex((node) => node && node.id === THEORY_CORE_ID);
  const theoryCore = createTheoryCoreNode(state.viewport);

  if (existingIndex === -1) {
    state.nodes.unshift(theoryCore);
  } else {
    state.nodes[existingIndex] = {
      ...theoryCore,
      ...state.nodes[existingIndex],
      id: THEORY_CORE_ID,
      text: THEORY_CORE_TITLE,
      keyword: THEORY_CORE_TITLE,
      keywords: [...THEORY_CORE_KEYWORDS, ...((state.nodes[existingIndex].keywords || []))],
      category: "Theory Core",
      semanticGroup: "Theory",
      role: "central",
      phase: "foundation",
      locked: true,
      fixed: true,
      stable: true,
      targetX: theoryCore.targetX,
      targetY: theoryCore.targetY,
      anchorX: theoryCore.anchorX,
      anchorY: theoryCore.anchorY,
      clusterCenterX: theoryCore.clusterCenterX,
      clusterCenterY: theoryCore.clusterCenterY,
      layoutWidth: theoryCore.layoutWidth,
      sizeScale: theoryCore.sizeScale,
    };
  }

  if (!state.selectedNode) {
    state.selectedNode = THEORY_CORE_ID;
  }
}

function getNodeById(nodeId) {
  return state.nodes.find((node) => node.id === nodeId) || null;
}

function getNodeSummary(node) {
  if (!node) {
    return "";
  }

  if (node.id === THEORY_CORE_ID) {
    return THEORY_CORE_TEXT;
  }

  const matchedWiki = state.wikiEntries.find((entry) => {
    const title = normalizeKey(entry.title);
    const keyword = normalizeKey(node.keyword || node.text || node.category || node.semanticGroup);
    return title && keyword && (title.includes(keyword) || keyword.includes(title));
  });

  if (matchedWiki?.summary) {
    return matchedWiki.summary;
  }

  const feedLine = [...state.feedLines].reverse().find((line) => normalizeKey(line.text || line.source).includes(normalizeKey(node.keyword || node.text)));
  return node.wikiSummary || feedLine?.text || node.description || node.text || "";
}

function describeEdge(edge) {
  if (!edge) {
    return "";
  }

  if (edge.explanation) {
    return edge.explanation;
  }

  const labels = {
    wiki: "linked through live Wikipedia ingestion",
    semantic: "connected through participation and semantic overlap",
    category: "connected through category clustering",
    theory: "connected through the theory core's semantic gravity",
    drift: "connected through spatial drift and proximity",
  };

  return labels[edge.type] || "related through the theory core";
}

function getSelectedNodeDetails() {
  const selectedNode = getNodeById(state.selectedNode) || getNodeById(THEORY_CORE_ID);
  if (!selectedNode) {
    return null;
  }

  const relatedEdges = state.edges
    .filter((edge) => {
      const left = state.nodes[edge.leftIndex ?? edge.sourceIndex ?? -1];
      const right = state.nodes[edge.rightIndex ?? edge.targetIndex ?? -1];
      return left?.id === selectedNode.id || right?.id === selectedNode.id;
    })
    .slice(0, 6);

  return {
    title: selectedNode.text || selectedNode.keyword || THEORY_CORE_TITLE,
    summary: getNodeSummary(selectedNode),
    type: selectedNode.id === THEORY_CORE_ID ? "Theory Core" : selectedNode.semanticGroup || selectedNode.category || selectedNode.role || "Node",
    categories: mergeUniqueStrings(selectedNode.wikiCategories || [], selectedNode.category ? [selectedNode.category] : []),
    links: mergeUniqueStrings(selectedNode.wikiLinks || []),
    relations: relatedEdges.map((edge) => ({
      label: edge.label || edge.type || "relation",
      explanation: describeEdge(edge),
      confidence: Math.round((edge.confidence ?? edge.score ?? 1) * 100),
      weight: edge.weight ?? edge.score ?? 1,
      evidence: mergeUniqueStrings(edge.keywords || [], edge.sharedCategories || [], edge.sharedLinks || [], edge.sharedTheorySignals || []).slice(0, 4),
      kind: edge.type || "semantic",
    })),
  };
}

function addFeedLine(entry) {
  const viewport = state.viewport;
  const baseline = viewport.height - 52;
  const lastLine = state.feedLines[state.feedLines.length - 1];
  const y = lastLine ? Math.max(lastLine.y + 24, baseline) : baseline;

  state.feedLines.push({
    ...entry,
    y,
    age: 0,
    opacity: entry.opacity ?? 0.94,
  });

  if (state.feedLines.length > MAX_FEED_LINES) {
    state.feedLines.splice(0, state.feedLines.length - MAX_FEED_LINES);
  }
}

function queueTransformationTerms(candidates) {
  let queued = false;

  for (const term of candidates) {
    const normalized = normalizeKey(term.text || term.keyword);
    if (!normalized || state.termKeys.has(normalized)) {
      continue;
    }

    state.termKeys.add(normalized);
    state.transformationQueue.push({
      ...term,
      id: normalized,
      keyword: term.keyword || term.text,
      text: String(term.text || term.keyword || normalized),
      source: term.source || "theorie",
      age: 0,
      opacity: term.opacity ?? 0.92,
      memoryOpacity: term.memoryOpacity ?? 0.72,
    });
    queued = true;
  }

  return queued;
}

function createTransformationFragment(term, index) {
  const lane = Number.isInteger(term.preferredLane) ? term.preferredLane : 1;
  const rowIndex = Number.isInteger(term.fragmentOrder) ? term.fragmentOrder : index;
  const spawnX = state.viewport.width * 0.12 + (index % 4) * 18;
  const spawnY = state.viewport.height * 0.24 + (rowIndex % 6) * 18;

  return {
    ...term,
    id: term.id || `node-${normalizeKey(term.keyword || term.text || index)}-${index}`,
    phase: "transformation",
    category: term.semanticGroup || term.role || "raw",
    links: [],
    lane,
    rowIndex,
    x: spawnX,
    y: spawnY,
    targetX: state.viewport.width * 0.52,
    targetY: state.viewport.height * 0.48 + (rowIndex % 5) * 10,
    anchorX: state.viewport.width * 0.52,
    anchorY: state.viewport.height * 0.48,
    clusterCenterX: state.viewport.width * 0.52,
    clusterCenterY: state.viewport.height * 0.48,
    spawnX,
    spawnY,
    depthLayer: 1,
    opacity: term.opacity ?? 0.82,
    memoryOpacity: term.memoryOpacity ?? 0.7,
    mass: Math.max(0.9, term.weight || 1),
    age: 0,
  };
}

function refreshGraphTopology() {
  const now = performance.now();
  state.edges = createSemanticEdges(state.nodes, state.wikiEntries, now);

  for (const seed of state.wikiSeed || []) {
    const leftIndex = state.nodes.findIndex((node) => normalizeKey(node.keyword || node.text) === normalizeKey(seed.source));
    const rightIndex = state.nodes.findIndex((node) => normalizeKey(node.keyword || node.text) === normalizeKey(seed.target));
    if (leftIndex === -1 || rightIndex === -1 || leftIndex === rightIndex) {
      continue;
    }

    state.edges.unshift({
      id: `seed-${leftIndex}-${rightIndex}`,
      source: state.nodes[leftIndex].id,
      target: state.nodes[rightIndex].id,
      sourceIndex: leftIndex,
      targetIndex: rightIndex,
      leftIndex,
      rightIndex,
      score: 1 + (seed.weight || 0),
      weight: 1 + (seed.weight || 0),
      confidence: 0.94,
      type: "semantic",
      label: seed.label || `${seed.source} / ${seed.target}`,
      bornAt: now,
      ttl: 14000,
      opacity: 0.14 + (seed.weight || 0) * 0.06,
    });
  }

  state.categories = createEmergentCategories(state.nodes, state.edges, now);
}

function collectExpansionTopics(node) {
  const terms = new Set();
  for (const keyword of node.keywords || []) {
    const normalized = String(keyword || "").trim();
    if (normalized) {
      terms.add(normalized);
    }
  }

  if (node.semanticGroup) {
    terms.add(node.semanticGroup);
  }
  if (node.category) {
    terms.add(node.category);
  }
  if (node.source) {
    terms.add(node.source);
  }

  for (const category of node.wikiCategories || []) {
    terms.add(category);
  }

  for (const link of node.wikiLinks || []) {
    terms.add(link);
  }

  return [...terms].slice(0, 4);
}

async function expandNode(node) {
  const topics = collectExpansionTopics(node);
  state.history = [
    {
      type: "expand",
      nodeId: node.id,
      label: node.text || node.keyword || node.category || node.semanticGroup || "node",
      at: Date.now(),
      topics,
    },
    ...state.history,
  ].slice(0, 40);
  state.selectedNode = node.id;

  for (const topic of topics.slice(0, 3)) {
    void loadWikipediaPulse(topic);
  }

  scheduleGraphStateSave(state);
}

function pickNodeAt(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let bestNode = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of state.nodes) {
    const radius = Math.max(16, (node.layoutWidth || 220) * 0.22);
    const distance = Math.hypot(x - node.x, y - node.y);
    if (distance <= radius && distance < bestDistance) {
      bestNode = node;
      bestDistance = distance;
    }
  }

  return bestNode;
}

function selectNodeById(nodeId, shouldExpand = false) {
  const node = getNodeById(nodeId);
  if (!node) {
    return;
  }

  state.selectedNode = node.id;

  if (shouldExpand) {
    void expandNode(node);
  } else {
    state.history = [
      {
        type: "select",
        nodeId: node.id,
        label: node.text || node.keyword || node.category || node.semanticGroup || "node",
        at: Date.now(),
      },
      ...state.history,
    ].slice(0, 40);
    scheduleGraphStateSave(state);
    renderWorkspacePanels();
  }
}

function fitText(ctx, text, maxWidth) {
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }

  const ellipsis = "…";
  let end = value.length;
  while (end > 0 && ctx.measureText(`${value.slice(0, end)}${ellipsis}`).width > maxWidth) {
    end -= 1;
  }

  return `${value.slice(0, Math.max(0, end))}${ellipsis}`;
}

function renderWorkspacePanels() {
  if (ingestionPanel) {
    const activeItems = [
      ...state.ingestionQueue.slice(0, 6).map((item) => ({
        title: item.source || "Ingestion",
        text: item.text || item.rawText || "",
        meta: `${(item.categories || item.wikiCategories || []).length} categories · ${(item.links || item.wikiLinks || []).length} links`,
        nodeId: item.nodeId || item.id || null,
      })),
      ...state.feedLines.slice(-4).map((line) => ({
        title: line.source || "Stream",
        text: line.text || "",
        meta: "processed ingestion",
      })),
    ];

    ingestionPanel.innerHTML = [
      `<div class="zone-meta"><span>queue ${state.ingestionQueue.length}</span><span>transform ${state.transformationQueue.length}</span></div>`,
      state.selectedNode ? `<div class="zone-meta"><span>selected</span><span>${escapeHtml(String(state.selectedNode))}</span></div>` : "",
      ...activeItems.map((item) => `
        <article class="zone-card"${item.nodeId ? ` data-node-id="${escapeHtml(item.nodeId)}"` : ""}>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.text)}</span>
          <small>${escapeHtml(item.meta)}</small>
        </article>
      `),
    ].join("");
  }

  if (foundationPanel) {
    const categories = Array.isArray(state.categories) ? state.categories.slice(0, 8) : [];
    const selectedDetails = getSelectedNodeDetails();

    foundationPanel.innerHTML = [
      `<div class="zone-meta"><span>nodes ${state.nodes.length}</span><span>edges ${state.edges.length}</span></div>`,
      selectedDetails ? `
        <article class="zone-card theory-details" data-node-id="${escapeHtml(String(state.selectedNode || THEORY_CORE_ID))}">
          <strong>${escapeHtml(selectedDetails.title)}</strong>
          <span>${escapeHtml(selectedDetails.type)}</span>
          <small>${escapeHtml(selectedDetails.summary || "No summary available yet.")}</small>
          ${selectedDetails.categories?.length ? `<small>Categories: ${escapeHtml(selectedDetails.categories.slice(0, 4).join(" · "))}</small>` : ""}
          ${selectedDetails.links?.length ? `<small>Internal links: ${escapeHtml(selectedDetails.links.slice(0, 4).join(" · "))}</small>` : ""}
        </article>
        <article class="zone-card theory-details" data-node-id="${escapeHtml(String(state.selectedNode || THEORY_CORE_ID))}">
          <strong>Connection Logic</strong>
          ${selectedDetails.relations.length
            ? selectedDetails.relations.map((relation) => `
              <span>${escapeHtml(relation.label)}</span>
              <small>${escapeHtml(relation.explanation)} · confidence ${relation.confidence}%${relation.evidence?.length ? ` · evidence ${escapeHtml(relation.evidence.join(" · "))}` : ""}</small>
            `).join("")
            : `<small>No active relations yet. Click another node to expand the neighborhood.</small>`
          }
        </article>
      ` : "",
      categories.length
        ? categories.map((category) => `
          <article class="zone-card"${category.nodeIds?.[0] ? ` data-node-id="${escapeHtml(category.nodeIds[0])}"` : ""}>
            <strong>${escapeHtml(String(category.label || category.id || "CATEGORY").toUpperCase())}</strong>
            <span>${escapeHtml(category.stable ? "stable cluster" : "emergent cluster")}</span>
            <small>${category.nodeCount || 0} nodes · density ${escapeHtml(String(category.density ?? 0))}</small>
            ${category.keywords?.length ? `<small>signals: ${escapeHtml(category.keywords.slice(0, 3).join(" · "))}</small>` : ""}
          </article>
        `).join("")
        : `
          <article class="zone-card">
            <strong>Waiting for emergence</strong>
            <span>Categories form only after sufficient density.</span>
            <small>center simulation active</small>
          </article>
        `,
    ].join("");
  }
}

async function loadInitialData() {
  const restored = loadGraphState(state);
  const [theoryCorpus, parsedTexts, wikiSeed] = await Promise.all([
    loadTheoryCorpus(),
    loadJson("./data/parsedTexts.json", []),
    loadJson("./data/wikiRelations.json", []),
  ]);

  const mergedCorpus = [
    ...theoryCorpus,
    ...parsedTexts,
  ];

  state.corpus = mergedCorpus;
  state.feedQueue = buildFeedEntries(mergedCorpus);
  ensureTheoryCoreNode();
  if (!restored || !state.nodes.length) {
    state.ingestionQueue = [...state.feedQueue];
    state.edges = [];
    state.categories = [];
  }
  state.selectedNode = state.selectedNode || THEORY_CORE_ID;
  state.wikiSeed = Array.isArray(wikiSeed) ? wikiSeed : [];

  if (state.nodes.length && (!restored || !state.edges.length || !state.categories.length)) {
    refreshGraphTopology();
  }

  state.nextTransformationAt = performance.now() + 600;
  renderWorkspacePanels();
}

async function loadWikipediaPulse(topic = null) {
  const nextTopic = topic || WIKI_TOPICS[state.wikiCursor % WIKI_TOPICS.length];
  if (!topic) {
    state.wikiCursor = (state.wikiCursor + 1) % WIKI_TOPICS.length;
  }

  try {
    const entry = await fetchWikipediaEntry(nextTopic);
    if (!entry) {
      return;
    }

    state.wikiEntries = [entry, ...state.wikiEntries].slice(0, 6);
    const node = upsertGraphNode(createWikipediaNode(entry));
    const summaryLine = entry.summary ? `${entry.title}: ${entry.summary}` : entry.title;
    state.ingestionQueue.push({
      id: node.id,
      nodeId: node.id,
      source: entry.title,
      text: summaryLine,
      rawText: entry.summary || entry.title,
      category: entry.title,
      categories: entry.categories || [],
      links: entry.links || [],
      wikiCategories: entry.categories || [],
      wikiLinks: entry.links || [],
      wikiSummary: entry.summary || "",
      wikiUrl: entry.url || "",
      phase: "ingestion",
      age: 0,
      opacity: 0.94,
    });
    scheduleGraphStateSave(state);
  } catch {
    return;
  }
}

function resize() {
  stage.resize();
  state.viewport = stage.getViewport();

  state.foundationState = createFoundationState(state.viewport);
  state.nodes = state.nodes.map((fragment) => {
    if (fragment.id === THEORY_CORE_ID) {
      const theoryCore = createTheoryCoreNode(state.viewport);
      return {
        ...theoryCore,
        ...fragment,
        id: THEORY_CORE_ID,
        text: THEORY_CORE_TITLE,
        keyword: THEORY_CORE_TITLE,
        keywords: [...THEORY_CORE_KEYWORDS, ...((fragment.keywords || []))],
        targetX: theoryCore.targetX,
        targetY: theoryCore.targetY,
        anchorX: theoryCore.anchorX,
        anchorY: theoryCore.anchorY,
        clusterCenterX: theoryCore.clusterCenterX,
        clusterCenterY: theoryCore.clusterCenterY,
        layoutWidth: theoryCore.layoutWidth,
        sizeScale: theoryCore.sizeScale,
      };
    }

    const lane = Number.isInteger(fragment.lane) ? fragment.lane : 1;
    const rowIndex = Number.isInteger(fragment.rowIndex) ? fragment.rowIndex : 0;
    const targetX = lane === 0
      ? state.foundationState.centerFlowX - state.foundationState.width * 0.04
      : lane === 1
        ? state.foundationState.centerFlowX + state.foundationState.width * 0.02
        : state.foundationState.rightFoundationX;
    const targetY = state.foundationState.marginY + rowIndex * state.foundationState.rowHeight;

    return {
      ...fragment,
      targetX,
      targetY,
      anchorX: targetX,
      anchorY: targetY,
      clusterCenterX: targetX,
      clusterCenterY: targetY,
      layoutWidth: state.foundationState.textWidth,
    };
  });

  state.foundationState.laneCounts = [0, 0, 0];
  for (const fragment of state.nodes) {
    if (Number.isInteger(fragment.lane) && fragment.lane >= 0 && fragment.lane <= 2) {
      state.foundationState.laneCounts[fragment.lane] += 1;
    }
  }
}

function tick(now) {
  if (!state.running) {
    return;
  }

  try {
    const delta = Math.min(48, now - state.lastFrameAt || 16.67);
    state.lastFrameAt = now;

    if (now >= state.nextFeedAt && state.ingestionQueue.length) {
      const nextLine = state.ingestionQueue.shift();
      if (nextLine) {
        addFeedLine(nextLine);
      }
      state.nextFeedAt = now + FEED_INTERVAL;
    }

    for (const line of state.feedLines) {
      line.age += delta / 1000;
      line.y -= state.feedSpeed * (delta / 1000);
      line.opacity = clamp(0.98 - line.age * 0.014, 0.1, 0.98);
    }

    state.feedLines = state.feedLines.filter((line) => line.y > -28);

    if (now >= state.nextExtractionAt) {
      const windowCorpus = [
        ...state.corpus.slice(-10),
        ...state.ingestionQueue.slice(-10).map((line) => ({ source: line.source, text: line.text })),
        ...state.feedLines.slice(-16).map((line) => ({ source: line.source, text: line.text })),
      ];
      const newTerms = extractFoundationTerms(windowCorpus, 18);
      queueTransformationTerms(newTerms);
      state.nextExtractionAt = now + EXTRACTION_INTERVAL;
    }

    if (now >= state.nextTransformationAt && state.transformationQueue.length) {
      const nextTerm = state.transformationQueue.shift();
      if (nextTerm) {
        upsertGraphNode(createTransformationFragment(nextTerm, state.nodes.length));
      }
      state.nextTransformationAt = now + 480;
    }

    const semanticCounts = new Map();
    for (const fragment of state.nodes) {
      const key = fragment.semanticGroup || fragment.category || fragment.role || "general";
      semanticCounts.set(key, (semanticCounts.get(key) || 0) + 1);
    }

    for (const fragment of state.nodes) {
      if (fragment.id === THEORY_CORE_ID) {
        fragment.text = THEORY_CORE_TITLE;
        fragment.keyword = THEORY_CORE_TITLE;
        fragment.targetX = state.viewport.width * 0.5;
        fragment.targetY = state.viewport.height * 0.46;
        fragment.anchorX = fragment.targetX;
        fragment.anchorY = fragment.targetY;
        fragment.clusterCenterX = fragment.targetX;
        fragment.clusterCenterY = fragment.targetY;
        fragment.depthLayer = 0;
        fragment.mass = 3;
        fragment.opacity = 1;
        fragment.memoryOpacity = 1;
        fragment.vx = 0;
        fragment.vy = 0;
        continue;
      }

      fragment.age = (fragment.age || 0) + delta / 1000;
      const groupKey = fragment.semanticGroup || fragment.category || fragment.role || "general";
      const groupCount = semanticCounts.get(groupKey) || 0;
      const relationDensity = state.edges.filter((relation) => {
        const left = state.nodes[relation.leftIndex ?? relation.sourceIndex ?? -1];
        const right = state.nodes[relation.rightIndex ?? relation.targetIndex ?? -1];
        return left && right && (left.semanticGroup === groupKey || right.semanticGroup === groupKey);
      }).length;

      if (fragment.phase !== "foundation" && groupCount >= 3 && relationDensity >= 2 && fragment.age > 6) {
        fragment.phase = "foundation";
        fragment.depthLayer = 2;
        fragment.text = String(fragment.semanticGroup || fragment.category || fragment.text || fragment.keyword || "CATEGORY").toUpperCase();
        fragment.keywords = [fragment.semanticGroup || fragment.category || fragment.keyword || fragment.text];
        fragment.targetX = state.viewport.width * 0.82;
        fragment.anchorX = fragment.targetX;
        fragment.clusterCenterX = fragment.targetX;
        fragment.targetY = state.foundationState.marginY + (fragment.rowIndex || 0) * state.foundationState.rowHeight;
        fragment.anchorY = fragment.targetY;
        fragment.clusterCenterY = fragment.targetY;
      }
    }

    if (now >= state.nextRelationAt) {
      refreshGraphTopology();
      state.nextRelationAt = now + RELATION_INTERVAL;
    }

    if (now >= state.nextWikiAt) {
      void loadWikipediaPulse();
      state.nextWikiAt = now + WIKI_INTERVAL;
    }

    updateFragments(state.nodes, state.edges, state.viewport, now, delta);
    updateSpatialMemory(state.nodes, delta);
    state.edges = updateRelationLayer(state.edges, now);

    renderWorkspacePanels();

    try {
      renderScene(context, state.viewport, state);
    } catch (error) {
      console.error("Render crash prevented:", error);
      const viewport = state.viewport || { width: canvas.width, height: canvas.height };
      const width = Number.isFinite(viewport.width) ? viewport.width : canvas.width;
      const height = Number.isFinite(viewport.height) ? viewport.height : canvas.height;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#111111";
      context.fillRect(0, 0, width, height);
      context.restore();
    }

    scheduleGraphStateSave(state);
  } catch (error) {
    console.error("Tick crash prevented:", error);
    const viewport = state.viewport || { width: canvas.width, height: canvas.height };
    const width = Number.isFinite(viewport.width) ? viewport.width : canvas.width;
    const height = Number.isFinite(viewport.height) ? viewport.height : canvas.height;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#111111";
    context.fillRect(0, 0, width, height);
    context.restore();
  } finally {
    requestAnimationFrame(tick);
  }
}

async function bootstrap() {
  await loadInitialData();
  resize();
  state.nextFeedAt = performance.now() + 120;
  state.nextExtractionAt = performance.now() + 600;
  state.nextRelationAt = performance.now() + 900;
  state.nextWikiAt = performance.now() + 1800;
  requestAnimationFrame(tick);
}

stageShell?.addEventListener("click", (event) => {
  if (event.target.closest(".zone, .zone-card, summary, details")) {
    return;
  }

  const node = pickNodeAt(event);
  if (!node) {
    return;
  }

  void expandNode(node);
  renderWorkspacePanels();
});

ingestionPanel?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-node-id]");
  if (!card?.dataset?.nodeId) {
    return;
  }

  selectNodeById(card.dataset.nodeId, true);
});

foundationPanel?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-node-id]");
  if (!card?.dataset?.nodeId) {
    return;
  }

  selectNodeById(card.dataset.nodeId, true);
});

window.addEventListener("resize", resize, { passive: true });

bootstrap().catch((error) => {
  console.error("The application could not be started.", error);
});