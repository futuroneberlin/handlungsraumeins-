import { useSyncExternalStore } from "react";
import { createFoundationState } from "../../core/layout.js";
import { THEORY_CORE_KEYWORDS, THEORY_CORE_TEXT, THEORY_CORE_TITLE } from "../../core/theoryModel.js";

const STORAGE_KEY = "handlungsraum.graphState.v1";

export function createInitialGraphState() {
  return {
    nodes: [],
    edges: [],
    categories: [],
    history: [],
    selectedNode: null,
    ingestionQueue: [],
    transformationQueue: [],
    feedQueue: [],
    feedLines: [],
    wikiEntries: [],
    wikiSeed: [],
    corpus: [],
    baseTerms: [],
    termKeys: new Set(),
    viewport: {
      width: 0,
      height: 0,
      dpr: 1,
    },
    foundationState: null,
    debug: false,
    hydrated: false,
    running: true,
    lastSavedAt: 0,
    lastFrameAt: 0,
    nextFeedAt: 0,
    nextExtractionAt: 0,
    nextRelationAt: 0,
    nextWikiAt: 0,
    nextTransformationAt: 0,
    wikiCursor: 0,
    feedSpeed: 16,
  };
}

function cloneList(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

export function serializeGraphState(state) {
  return {
    version: 1,
    savedAt: Date.now(),
    selectedNode: state.selectedNode ?? null,
    nodes: cloneList(state.nodes),
    edges: cloneList(state.edges),
    categories: cloneList(state.categories),
    history: cloneList(state.history),
  };
}

export function saveGraphState(state) {
  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeGraphState(state)));
    state.lastSavedAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

export function scheduleGraphStateSave(state, delay = 600) {
  if (typeof window === "undefined") {
    return;
  }

  if (state._saveTimer) {
    window.clearTimeout(state._saveTimer);
  }

  state._saveTimer = window.setTimeout(() => {
    state._saveTimer = 0;
    saveGraphState(state);
  }, delay);
}

export function loadGraphState(state) {
  if (typeof localStorage === "undefined") {
    return false;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return false;
    }

    state.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    state.edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    state.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    state.history = Array.isArray(parsed.history) ? parsed.history : [];
    state.selectedNode = parsed.selectedNode ?? null;
    state.hydrated = true;
    return true;
  } catch {
    return false;
  }
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function mergeUniqueStrings(...values) {
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

export function nodeIdentity(node) {
  return normalizeKey(node?.id || node?.wikiTitle || node?.keyword || node?.text || node?.title || "");
}

export function createTheoryCoreNode(viewport) {
  const width = viewport.width || 1280;
  const height = viewport.height || 800;

  return {
    id: "theory-core-actional-space",
    text: THEORY_CORE_TITLE,
    keyword: THEORY_CORE_TITLE,
    keywords: [...THEORY_CORE_KEYWORDS],
    concepts: [
      "Embodied Collective Action",
      "Temporal Sculptural Transformation",
      "Spatial Configuration",
      "Social Sculpture",
      "Aesthetic Practice",
    ],
    semanticWeights: {
      "Embodied Collective Action": 1.6,
      "Temporal Sculptural Transformation": 1.45,
      "Spatial Configuration": 1.3,
      "Social Sculpture": 1.55,
      "Aesthetic Practice": 1.2,
    },
    theoryResonanceScore: 1,
    semanticDensity: 1,
    semanticSignature: "theory-core-actional-space",
    semanticLabel: THEORY_CORE_TITLE,
    relationCandidates: [],
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

export function ensureTheoryCoreNode(state) {
  const existingIndex = state.nodes.findIndex((node) => node && node.id === "theory-core-actional-space");
  const theoryCore = createTheoryCoreNode(state.viewport);

  if (existingIndex === -1) {
    state.nodes.unshift(theoryCore);
  } else {
    state.nodes[existingIndex] = {
      ...theoryCore,
      ...state.nodes[existingIndex],
      id: "theory-core-actional-space",
      text: THEORY_CORE_TITLE,
      keyword: THEORY_CORE_TITLE,
      keywords: [...THEORY_CORE_KEYWORDS, ...((state.nodes[existingIndex].keywords || []))],
      concepts: [
        ...new Set([
          ...(state.nodes[existingIndex].concepts || []),
          "Embodied Collective Action",
          "Temporal Sculptural Transformation",
          "Spatial Configuration",
          "Social Sculpture",
        ]),
      ],
      semanticWeights: {
        ...(state.nodes[existingIndex].semanticWeights || {}),
        "Embodied Collective Action": 1.6,
        "Temporal Sculptural Transformation": 1.45,
        "Spatial Configuration": 1.3,
        "Social Sculpture": 1.55,
        "Aesthetic Practice": 1.2,
      },
      theoryResonanceScore: 1,
      semanticDensity: 1,
      semanticSignature: "theory-core-actional-space",
      semanticLabel: THEORY_CORE_TITLE,
      relationCandidates: state.nodes[existingIndex].relationCandidates || [],
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
    state.selectedNode = "theory-core-actional-space";
  }
}

export function createGraphStore(initialState = createInitialGraphState()) {
  let state = initialState;
  let version = 0;
  const listeners = new Set();

  return {
    getState() {
      return state;
    },
    getVersion() {
      return version;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(mutator) {
      mutator(state);
      version += 1;
      listeners.forEach((listener) => listener());
    },
    replace(nextState) {
      state = nextState;
      version += 1;
      listeners.forEach((listener) => listener());
    },
    patch(partial) {
      state = {
        ...state,
        ...partial,
      };
      version += 1;
      listeners.forEach((listener) => listener());
    },
  };
}

export const graphStore = createGraphStore();

export function useGraphVersion(store = graphStore) {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}

export function makeFeedEntry(entry, index) {
  return {
    id: `feed-${index}-${normalizeKey(entry.text)}`,
    source: entry.source || "theory",
    text: entry.text,
    age: 0,
    opacity: 0.92,
    y: 0,
  };
}

export function createFeedEntries(corpus) {
  return (Array.isArray(corpus) ? corpus : []).flatMap((entry) => {
    const text = String(entry.text || "");
    return text
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => ({ source: entry.source || "theory", text: part }));
  }).map((entry, index) => makeFeedEntry(entry, index));
}

export function createNodeIndexMap(nodes) {
  const map = new Map();
  (Array.isArray(nodes) ? nodes : []).forEach((node, index) => {
    map.set(node.id, index);
    map.set(nodeIdentity(node), index);
  });
  return map;
}

export function createViewportFoundation(viewport) {
  return createFoundationState(viewport);
}
