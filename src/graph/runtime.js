import { createFoundationState } from "../../core/layout.js";
import { extractFoundationTerms } from "../../modules/semanticExtractor.js";
import { loadTheoryCorpus } from "../../modules/theoryLoader.js";
import { ensureTheoryCoreNode, mergeUniqueStrings, scheduleGraphStateSave } from "./graphState.js";
import { buildFeedEntries, collectExpansionTopics, createWikipediaNode, loadWikipediaPulse } from "./wikipediaIngestion.js";
import { refreshCategories } from "./categoryEngine.js";
import { advanceForceSimulation } from "./forceSimulation.js";
import { refreshSemanticTopology } from "./semanticResolver.js";

const WIKI_TOPICS = [
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

const MAX_FEED_LINES = 72;
const FEED_INTERVAL = 420;
const EXTRACTION_INTERVAL = 2600;
const RELATION_INTERVAL = 4200;
const WIKI_INTERVAL = 7500;
const THEORY_CORE_ID = "theory-core-actional-space";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
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

function createFeedLine(entry) {
  return {
    ...entry,
    y: 0,
    age: 0,
    opacity: entry.opacity ?? 0.94,
  };
}

function mergeGraphNode(state, candidate) {
  if (!candidate) {
    return null;
  }

  const identity = normalizeKey(candidate.id || candidate.wikiTitle || candidate.keyword || candidate.text || candidate.title || "");
  const existingIndex = state.nodes.findIndex((node) => node.id === candidate.id || normalizeKey(node.id || node.wikiTitle || node.keyword || node.text || node.title || "") === identity);
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

function refreshGraphTopology(state) {
  const { edges, categories } = refreshSemanticTopology(state, performance.now());
  state.edges = edges;
  state.categories = categories;

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
      bornAt: performance.now(),
      ttl: 14000,
      opacity: 0.14 + (seed.weight || 0) * 0.06,
    });
  }

  state.categories = categories;
}

function collectExpansionTopicsFromNode(node) {
  const topics = collectExpansionTopics(node);
  return topics;
}

export function createGraphActions(store) {
  return {
    async bootstrap() {
      const state = store.getState();
      const [theoryCorpus, parsedTexts, wikiSeed] = await Promise.all([
        loadTheoryCorpus(),
        loadJson("./data/parsedTexts.json", []),
        loadJson("./data/wikiRelations.json", []),
      ]);

      const mergedCorpus = [...theoryCorpus, ...parsedTexts];
      state.corpus = mergedCorpus;
      state.feedQueue = buildFeedEntries(mergedCorpus);
      state.ingestionQueue = [...state.feedQueue];
      state.wikiSeed = Array.isArray(wikiSeed) ? wikiSeed : [];
      state.foundationState = createFoundationState(state.viewport);
      ensureTheoryCoreNode(state);
      state.selectedNode = state.selectedNode || THEORY_CORE_ID;
      refreshGraphTopology(state);
      state.nextTransformationAt = performance.now() + 600;
      state.nextFeedAt = performance.now() + 120;
      state.nextExtractionAt = performance.now() + 600;
      state.nextRelationAt = performance.now() + 900;
      state.nextWikiAt = performance.now() + 1800;
      scheduleGraphStateSave(state);
      store.update((draft) => {
        Object.assign(draft, state);
      });
    },

    setViewport(viewport) {
      store.update((draft) => {
        draft.viewport = viewport;
        draft.foundationState = createFoundationState(viewport);
        for (const node of draft.nodes) {
          if (node.id === THEORY_CORE_ID) {
            node.x = viewport.width * 0.5;
            node.y = viewport.height * 0.46;
            node.targetX = viewport.width * 0.5;
            node.targetY = viewport.height * 0.46;
            node.anchorX = node.targetX;
            node.anchorY = node.targetY;
            node.clusterCenterX = node.targetX;
            node.clusterCenterY = node.targetY;
            node.layoutWidth = Math.max(320, viewport.width * 0.32);
          }
        }
      });
    },

    upsertNode(candidate) {
      let node = null;
      store.update((draft) => {
        node = mergeGraphNode(draft, candidate);
      });
      return node;
    },

    selectNode(nodeId, shouldExpand = false) {
      const state = store.getState();
      const node = state.nodes.find((item) => item.id === nodeId);
      if (!node) {
        return;
      }

      store.update((draft) => {
        draft.selectedNode = node.id;
        draft.history = [
          {
            type: shouldExpand ? "expand" : "select",
            nodeId: node.id,
            label: node.text || node.keyword || node.category || node.semanticGroup || "node",
            at: Date.now(),
            topics: shouldExpand ? collectExpansionTopicsFromNode(node) : undefined,
          },
          ...draft.history,
        ].slice(0, 40);
      });

      if (shouldExpand) {
        this.expandNode(node);
      }
    },

    async expandNode(node) {
      const topics = collectExpansionTopicsFromNode(node);
      for (const topic of topics.slice(0, 3)) {
        void this.ingestWikipediaPulse(topic);
      }
      scheduleGraphStateSave(store.getState());
    },

    async ingestWikipediaPulse(topic = null) {
      const state = store.getState();
      const nextTopic = topic || WIKI_TOPICS[state.wikiCursor % WIKI_TOPICS.length];
      if (!topic) {
        state.wikiCursor = (state.wikiCursor + 1) % WIKI_TOPICS.length;
      }

      try {
        const entry = await loadWikipediaPulse(nextTopic);
        if (!entry) {
          return;
        }

        store.update((draft) => {
          draft.wikiEntries = [entry, ...draft.wikiEntries].slice(0, 6);
          const node = mergeGraphNode(draft, createWikipediaNode(entry, draft.viewport, draft.nodes.length));
          const excerpt = String(entry.summary || "")
            .replace(/\s+/g, " ")
            .trim()
            .split(/\s+/)
            .slice(0, 18)
            .join(" ");
          draft.ingestionQueue.push(createFeedLine({
            id: node.id,
            nodeId: node.id,
            source: entry.title,
            title: entry.title,
            text: excerpt || entry.title,
            excerpt: excerpt || entry.title,
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
          }));
        });
        scheduleGraphStateSave(store.getState());
      } catch {
        return;
      }
    },

    refreshTopology() {
      store.update((draft) => {
        refreshGraphTopology(draft);
      });
    },

    tick(now) {
      const state = store.getState();
      if (!state.running) {
        return;
      }

      const delta = Math.min(48, now - state.lastFrameAt || 16.67);

      store.update((draft) => {
        draft.lastFrameAt = now;

        if (now >= draft.nextFeedAt && draft.ingestionQueue.length) {
          const nextLine = draft.ingestionQueue.shift();
          if (nextLine) {
            draft.feedLines.push({
              ...nextLine,
              y: draft.viewport.height - 52,
              age: 0,
              opacity: nextLine.opacity ?? 0.94,
              text: nextLine.excerpt || nextLine.text || "",
              excerpt: nextLine.excerpt || nextLine.text || "",
            });
          }
          draft.nextFeedAt = now + FEED_INTERVAL;
        }

        for (const line of draft.feedLines) {
          line.age += delta / 1000;
          line.y -= draft.feedSpeed * (delta / 1000);
          line.opacity = clamp(0.98 - line.age * 0.014, 0.1, 0.98);
        }

        draft.feedLines = draft.feedLines.filter((line) => line.y > -28);

        if (now >= draft.nextExtractionAt) {
          const windowCorpus = [
            ...draft.corpus.slice(-10),
            ...draft.ingestionQueue.slice(-10).map((line) => ({ source: line.source, text: line.text })),
            ...draft.feedLines.slice(-16).map((line) => ({ source: line.source, text: line.text })),
          ];
          const newTerms = extractFoundationTerms(windowCorpus, 18);
          for (const term of newTerms) {
            const normalized = normalizeKey(term.text || term.keyword);
            if (!normalized || draft.termKeys.has(normalized)) {
              continue;
            }
            draft.termKeys.add(normalized);
            draft.transformationQueue.push({
              ...term,
              id: normalized,
              keyword: term.keyword || term.text,
              title: term.title || term.keyword || term.text || normalized,
              text: String(term.excerpt || term.text || term.keyword || normalized),
              excerpt: term.excerpt || term.text || term.keyword || normalized,
              source: term.source || "theorie",
              age: 0,
              opacity: term.opacity ?? 0.92,
              memoryOpacity: term.memoryOpacity ?? 0.72,
            });
          }
          draft.nextExtractionAt = now + EXTRACTION_INTERVAL;
        }

        if (now >= draft.nextTransformationAt && draft.transformationQueue.length) {
          const nextTerm = draft.transformationQueue.shift();
          if (nextTerm) {
            draft.nodes.push({
              ...nextTerm,
              id: nextTerm.id || `node-${normalizeKey(nextTerm.keyword || nextTerm.text || draft.nodes.length)}-${draft.nodes.length}`,
              phase: "transformation",
              category: nextTerm.semanticGroup || nextTerm.role || "raw",
              links: [],
              lane: Number.isInteger(nextTerm.preferredLane) ? nextTerm.preferredLane : 1,
              rowIndex: Number.isInteger(nextTerm.fragmentOrder) ? nextTerm.fragmentOrder : draft.nodes.length,
              x: draft.viewport.width * 0.12,
              y: draft.viewport.height * 0.24,
              targetX: draft.viewport.width * 0.52,
              targetY: draft.viewport.height * 0.48,
              anchorX: draft.viewport.width * 0.52,
              anchorY: draft.viewport.height * 0.48,
              clusterCenterX: draft.viewport.width * 0.52,
              clusterCenterY: draft.viewport.height * 0.48,
              depthLayer: 1,
              opacity: nextTerm.opacity ?? 0.82,
              memoryOpacity: nextTerm.memoryOpacity ?? 0.7,
              mass: Math.max(0.9, nextTerm.weight || 1),
              age: 0,
              title: nextTerm.title || nextTerm.keyword || nextTerm.text,
              semanticLabel: nextTerm.title || nextTerm.keyword || nextTerm.text,
              semanticExcerpt: nextTerm.excerpt || nextTerm.text || "",
              concepts: nextTerm.keywords || [],
            });
          }
          draft.nextTransformationAt = now + 480;
        }

        for (const fragment of draft.nodes) {
          if (fragment.id === THEORY_CORE_ID) {
            fragment.text = "Actional Space of Aesthetic Practice";
            fragment.keyword = "Actional Space of Aesthetic Practice";
            fragment.targetX = draft.viewport.width * 0.5;
            fragment.targetY = draft.viewport.height * 0.46;
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
        }

        if (now >= draft.nextRelationAt) {
          refreshGraphTopology(draft);
          draft.nextRelationAt = now + RELATION_INTERVAL;
        }

        if (now >= draft.nextWikiAt) {
          void this.ingestWikipediaPulse();
          draft.nextWikiAt = now + WIKI_INTERVAL;
        }

        advanceForceSimulation(draft, now, delta);
        draft.categories = refreshCategories(draft, now);
        scheduleGraphStateSave(draft);
      });
    },
  };
}

export { createGraphStore, createInitialGraphState, graphStore } from "./graphState.js";
