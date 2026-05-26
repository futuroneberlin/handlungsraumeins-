import { createFoundationState } from "../../core/layout.js";
import { extractFoundationTerms } from "../../modules/semanticExtractor.js";
import { loadTheoryCorpus } from "../../modules/theoryLoader.js";
import { curateSemanticSignals, evaluateTheoryResonance, evaluateNodeTheoryResonance } from "../../core/theoryModel.js";
import { ensureTheoryCoreNode, mergeUniqueStrings, scheduleGraphStateSave } from "./graphState.js";
import { buildFeedEntries, collectExpansionTopics, loadWikipediaPulse } from "./wikipediaIngestion.js";
import { refreshCategories } from "./categoryEngine.js";
import { advanceForceSimulation } from "./forceSimulation.js";
import { refreshSemanticTopology } from "./semanticResolver.js";

const WIKI_TOPICS = [
  "Participation (decision making)",
  "Temporality",
  "Spatial interaction",
  "Public space",
  "Architecture",
  "Collective Action",
  "Aesthetics",
  "Social Sculpture",
];

const MAX_FEED_LINES = 24;
const MAX_QUEUE_ITEMS = 24;
const MAX_TRANSFORMATION_QUEUE = 12;
const MAX_NODES = 18;
const MAX_WIKI_ENTRIES = 3;
const FEED_INTERVAL = 980;
const EXTRACTION_INTERVAL = 5200;
const RELATION_INTERVAL = 5600;
const WIKI_INTERVAL = 18000;
const MIN_WIKI_RESONANCE = 1.15;
const THEORY_CORE_ID = "theory-core-actional-space";
const THEORY_ATTRACTORS = [
  { id: "theory-attractor-participation", label: "Participation", group: "Gesellschaft", xFactor: 0.34, yFactor: 0.3 },
  { id: "theory-attractor-temporality", label: "Temporality", group: "Handlung", xFactor: 0.5, yFactor: 0.24 },
  { id: "theory-attractor-spatial-transformation", label: "Spatial Transformation", group: "Raum", xFactor: 0.66, yFactor: 0.3 },
  { id: "theory-attractor-embodied-action", label: "Embodied Action", group: "Handlung", xFactor: 0.29, yFactor: 0.52 },
  { id: "theory-attractor-collective-experience", label: "Collective Experience", group: "Gesellschaft", xFactor: 0.71, yFactor: 0.52 },
  { id: "theory-attractor-processual-form", label: "Processual Form", group: "Konstruktion", xFactor: 0.39, yFactor: 0.72 },
  { id: "theory-attractor-relational-construction", label: "Relational Construction", group: "Kunst", xFactor: 0.61, yFactor: 0.72 },
];

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

function cleanExtractionText(text, maxSentences = 2, maxWords = 42) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, maxSentences);
  const reduced = sentences.join(" ").trim();
  return reduced.split(/\s+/).slice(0, maxWords).join(" ");
}

function uniqueRelevantTags(values = [], max = 5) {
  const seen = new Set();
  const tags = [];
  for (const value of values) {
    const tag = String(value || "").trim();
    if (!tag) {
      continue;
    }
    const key = normalizeKey(tag);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(tag);
    if (tags.length >= max) {
      break;
    }
  }
  return tags;
}

function isAnchorNode(node) {
  return node?.id === THEORY_CORE_ID || node?.isTheoryAttractor;
}

function scoreOverlap(leftValues = [], rightValues = []) {
  const right = new Set((rightValues || []).map((value) => normalizeKey(value)).filter(Boolean));
  return (leftValues || []).filter((value) => right.has(normalizeKey(value))).length;
}

function findCondensationTarget(state, candidate) {
  const candidateLabel = normalizeKey(candidate.semanticLabel || candidate.title || candidate.keyword || candidate.text || "");
  const candidateConcepts = candidate.concepts || candidate.keywords || [];
  let best = null;
  let bestScore = 0;

  for (const node of state.nodes || []) {
    if (!node || isAnchorNode(node)) {
      continue;
    }

    const nodeLabel = normalizeKey(node.semanticLabel || node.title || node.keyword || node.text || "");
    const sharedConcepts = scoreOverlap(candidateConcepts, node.concepts || node.keywords || []);
    const labelMatch = candidateLabel && nodeLabel && (candidateLabel === nodeLabel || candidateLabel.includes(nodeLabel) || nodeLabel.includes(candidateLabel));
    const score = sharedConcepts * 1.2 + (labelMatch ? 2.4 : 0) + Math.min(node.theoryResonanceScore || 0, candidate.theoryResonanceScore || 0);

    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  }

  return bestScore >= 2.4 ? best : null;
}

function ensureTheoryAttractors(state) {
  const width = Math.max(320, state.viewport?.width || 1280);
  const height = Math.max(240, state.viewport?.height || 800);

  for (const attractor of THEORY_ATTRACTORS) {
    const x = width * attractor.xFactor;
    const y = height * attractor.yFactor;
    const index = state.nodes.findIndex((node) => node.id === attractor.id);
    const attractorNode = {
      id: attractor.id,
      title: attractor.label,
      text: attractor.label,
      keyword: attractor.label,
      semanticLabel: attractor.label,
      concepts: [attractor.label, "Actional Space of Aesthetic Practice"],
      keywords: [attractor.label, "action", "space", "practice"],
      semanticGroup: attractor.group,
      category: attractor.group,
      role: "attractor",
      phase: "stabilization",
      isTheoryAttractor: true,
      fixed: true,
      locked: true,
      stable: true,
      x,
      y,
      targetX: x,
      targetY: y,
      anchorX: x,
      anchorY: y,
      clusterCenterX: x,
      clusterCenterY: y,
      layoutWidth: Math.max(180, width * 0.14),
      sizeScale: 1.16,
      mass: 2.4,
      weight: 1.8,
      z: 0.38,
      opacity: 0.9,
      memoryOpacity: 0.9,
      theoryResonanceScore: 1,
      semanticDensity: 0.92,
      relationCandidates: [],
      appearanceCount: 1,
      firstSeenAt: performance.now(),
      lastSeenAt: performance.now(),
    };

    if (index === -1) {
      state.nodes.push(attractorNode);
      continue;
    }

    state.nodes[index] = {
      ...state.nodes[index],
      ...attractorNode,
      appearanceCount: (state.nodes[index].appearanceCount || 1) + 1,
      firstSeenAt: state.nodes[index].firstSeenAt || performance.now(),
      lastSeenAt: performance.now(),
    };
  }
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
      concepts: mergeUniqueStrings(candidate.concepts || [], candidate.keywords || [], candidate.wikiCategories || [], candidate.keyword || candidate.text),
      semanticWeights: candidate.semanticWeights || {},
      wikiCategories: mergeUniqueStrings(candidate.wikiCategories || []),
      wikiLinks: mergeUniqueStrings(candidate.wikiLinks || []),
      theoryResonanceScore: candidate.theoryResonanceScore ?? 0,
      semanticDensity: candidate.semanticDensity ?? 0,
      semanticSignature: candidate.semanticSignature || null,
      semanticLabel: candidate.semanticLabel || candidate.title || candidate.keyword || candidate.text || null,
      relationCandidates: Array.isArray(candidate.relationCandidates) ? candidate.relationCandidates : [],
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
    concepts: mergeUniqueStrings(existing.concepts || [], candidate.concepts || [], candidate.keywords || [], candidate.wikiCategories || []),
    semanticWeights: {
      ...(existing.semanticWeights || {}),
      ...(candidate.semanticWeights || {}),
    },
    wikiCategories: mergeUniqueStrings(existing.wikiCategories || [], candidate.wikiCategories || []),
    wikiLinks: mergeUniqueStrings(existing.wikiLinks || [], candidate.wikiLinks || []),
    wikiSummary: candidate.wikiSummary || existing.wikiSummary || candidate.summary || existing.summary || "",
    wikiUrl: candidate.wikiUrl || existing.wikiUrl || candidate.url || existing.url || "",
    category: candidate.category || existing.category,
    semanticGroup: candidate.semanticGroup || existing.semanticGroup,
    role: candidate.role || existing.role,
    theoryResonanceScore: Math.max(existing.theoryResonanceScore || 0, candidate.theoryResonanceScore || 0),
    semanticDensity: Math.max(existing.semanticDensity || 0, candidate.semanticDensity || 0),
    semanticSignature: candidate.semanticSignature || existing.semanticSignature || null,
    semanticLabel: candidate.semanticLabel || existing.semanticLabel || existing.title || candidate.title || candidate.keyword || null,
    relationCandidates: Array.isArray(candidate.relationCandidates) && candidate.relationCandidates.length ? candidate.relationCandidates : (existing.relationCandidates || []),
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

function trimNodeField(state) {
  if ((state.nodes || []).length <= MAX_NODES) {
    return;
  }

  const removable = state.nodes
    .map((node, index) => ({ node, index }))
    .filter((entry) => !isAnchorNode(entry.node))
    .sort((left, right) => {
      const leftScore = (left.node.semanticDensity || 0) + (left.node.theoryResonanceScore || 0) + (left.node.weight || 0) * 0.1;
      const rightScore = (right.node.semanticDensity || 0) + (right.node.theoryResonanceScore || 0) + (right.node.weight || 0) * 0.1;
      return leftScore - rightScore || (left.node.appearanceCount || 0) - (right.node.appearanceCount || 0);
    });

  const removeCount = Math.max(0, state.nodes.length - MAX_NODES);
  const indicesToRemove = new Set(removable.slice(0, removeCount).map((entry) => entry.index));
  if (!indicesToRemove.size) {
    return;
  }

  state.nodes = state.nodes.filter((_, index) => !indicesToRemove.has(index));
  state.edges = (state.edges || []).filter((edge) => {
    const sourceId = edge.source;
    const targetId = edge.target;
    return state.nodes.some((node) => node.id === sourceId) && state.nodes.some((node) => node.id === targetId);
  });
}

function createCuratedIngestionItem(entry) {
  const sourceSummary = String(entry?.summary || entry?.excerpt || entry?.title || "").trim();
  const evaluation = evaluateTheoryResonance([
    entry?.title,
    sourceSummary,
    ...(entry?.concepts || []),
    ...(entry?.categories || []),
    ...(entry?.links || []),
  ], { minScore: 1.95 });
  if (evaluation.reject) {
    return null;
  }

  const curatedSignals = curateSemanticSignals([
    entry?.title,
    ...(entry?.concepts || []),
    ...(entry?.categories || []),
    ...(entry?.links || []),
    sourceSummary,
  ], { minScore: 1.18 });
  if (!curatedSignals.length) {
    return null;
  }

  const tags = uniqueRelevantTags(curatedSignals.map((item) => item.signal), 4);
  const cleanedExcerpt = cleanExtractionText(sourceSummary, 3, 48);
  if (!cleanedExcerpt) {
    return null;
  }

  return createFeedLine({
    id: `ingestion-${normalizeKey(entry?.title || entry?.term || Date.now())}-${Date.now()}`,
    nodeId: null,
    source: "Wikipedia",
    title: entry?.title || entry?.term || "Fragment",
    text: cleanedExcerpt,
    excerpt: cleanedExcerpt,
    rawText: entry?.summary || entry?.excerpt || entry?.title || "",
    category: entry?.title || "Fragment",
    categories: [],
    links: [],
    keywords: tags,
    concept: tags[0] || entry?.title || "Fragment",
    wikiCategories: [],
    wikiLinks: [],
    wikiSummary: cleanedExcerpt,
    wikiUrl: entry?.url || "",
    concepts: tags,
    activatedDimensions: evaluation.activatedDimensions || [],
    theoryRelevance: Number(evaluation.score || 0),
    phase: "ingestion",
    age: 0,
    opacity: 0.88,
  });
}

function refreshGraphTopology(state) {
  const { nodes, edges, categories } = refreshSemanticTopology(state, performance.now());
  state.nodes = nodes;
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
      ensureTheoryAttractors(state);
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
        ensureTheoryAttractors(draft);
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
      for (const topic of topics.slice(0, 1)) {
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
        if (!entry || (entry.resonanceScore || 0) < MIN_WIKI_RESONANCE || !Array.isArray(entry.concepts) || entry.concepts.length < 2) {
          return;
        }

        const curatedItem = createCuratedIngestionItem(entry);
        if (!curatedItem) {
          return;
        }

        store.update((draft) => {
          draft.wikiEntries = [entry, ...draft.wikiEntries].slice(0, MAX_WIKI_ENTRIES);
          draft.ingestionQueue.push(curatedItem);
          if (draft.ingestionQueue.length > MAX_QUEUE_ITEMS) {
            draft.ingestionQueue = draft.ingestionQueue.slice(-MAX_QUEUE_ITEMS);
          }
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
        ensureTheoryAttractors(draft);

        if (now >= draft.nextFeedAt && draft.ingestionQueue.length) {
          const nextLine = draft.ingestionQueue.shift();
          if (nextLine && Number(nextLine.theoryRelevance || 0) >= 1.95) {
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

        draft.feedLines = draft.feedLines.filter((line) => line.y > -28).slice(-MAX_FEED_LINES);

        if (now >= draft.nextExtractionAt) {
          const windowCorpus = [
            ...draft.corpus.slice(-10),
            ...draft.ingestionQueue.slice(-10).map((line) => ({ source: line.source, text: line.text })),
            ...draft.feedLines.slice(-16).map((line) => ({ source: line.source, text: line.text })),
          ];
          const newTerms = extractFoundationTerms(windowCorpus, 10);
          for (const term of newTerms) {
            const normalized = normalizeKey(term.text || term.keyword);
            if (!normalized || draft.termKeys.has(normalized)) {
              continue;
            }
            const termValidation = evaluateTheoryResonance([
              term.title,
              term.text,
              ...(term.concepts || []),
              ...(term.keywords || []),
              term.semanticGroup,
              term.role,
            ], { minScore: 1.85 });
            if (termValidation.reject) {
              continue;
            }
            if ((term.theoryResonanceScore || 0) < 0.54 || (term.semanticDensity || 0) < 0.26) {
              continue;
            }
            if (draft.transformationQueue.length >= MAX_TRANSFORMATION_QUEUE) {
              break;
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
              activatedDimensions: termValidation.activatedDimensions,
              theoryValidationScore: termValidation.score,
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
            const condensedTarget = findCondensationTarget(draft, nextTerm);
            if (condensedTarget) {
              condensedTarget.concepts = mergeUniqueStrings(condensedTarget.concepts || [], nextTerm.concepts || [], nextTerm.keywords || []);
              condensedTarget.keywords = mergeUniqueStrings(condensedTarget.keywords || [], nextTerm.keywords || [], nextTerm.keyword);
              condensedTarget.weight = Math.min(4.2, (condensedTarget.weight || 1) + Math.max(0.12, nextTerm.weight || 0.2));
              condensedTarget.mass = Math.min(5.4, (condensedTarget.mass || 1) + 0.12);
              condensedTarget.semanticDensity = clamp((condensedTarget.semanticDensity || 0.3) + 0.05, 0, 1);
              condensedTarget.theoryResonanceScore = clamp(Math.max(condensedTarget.theoryResonanceScore || 0, nextTerm.theoryResonanceScore || 0) + 0.03, 0, 1);
              condensedTarget.semanticExcerpt = cleanExtractionText(`${condensedTarget.semanticExcerpt || condensedTarget.text || ""} ${nextTerm.excerpt || nextTerm.text || ""}`, 3, 46);
              condensedTarget.phase = (condensedTarget.theoryResonanceScore || 0) + (condensedTarget.semanticDensity || 0) > 1.14 ? "stabilization" : "formation";
              condensedTarget.lastSeenAt = performance.now();
              condensedTarget.appearanceCount = (condensedTarget.appearanceCount || 1) + 1;
              condensedTarget.theoryDimensions = mergeUniqueStrings(condensedTarget.theoryDimensions || [], nextTerm.activatedDimensions || []);
            } else {
              draft.nodes.push({
              ...nextTerm,
              id: nextTerm.id || `node-${normalizeKey(nextTerm.keyword || nextTerm.text || draft.nodes.length)}-${draft.nodes.length}`,
              phase: "transformation",
              category: nextTerm.semanticGroup || nextTerm.role || "raw",
              links: [],
              concepts: mergeUniqueStrings(nextTerm.concepts || [], nextTerm.keywords || [], nextTerm.semanticGroup || nextTerm.role),
              semanticWeights: nextTerm.semanticWeights || Object.fromEntries((nextTerm.keywords || []).map((keyword, keywordIndex) => [keyword, Number((1 - keywordIndex * 0.12).toFixed(3))])),
              semanticLabel: nextTerm.semanticLabel || nextTerm.title || nextTerm.keyword || nextTerm.text,
              semanticSignature: nextTerm.semanticSignature || null,
              semanticDensity: nextTerm.semanticDensity ?? 0,
              theoryResonanceScore: nextTerm.theoryResonanceScore ?? nextTerm.resonance ?? 0,
              theoryDimensions: nextTerm.activatedDimensions || [],
              relationCandidates: Array.isArray(nextTerm.relationCandidates) ? nextTerm.relationCandidates : [],
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
              semanticExcerpt: nextTerm.excerpt || nextTerm.text || "",
              });
            }
            trimNodeField(draft);
          }
          draft.nextTransformationAt = now + 1400;
        }

        for (const fragment of draft.nodes) {
          if (fragment.isTheoryAttractor) {
            fragment.phase = "stabilization";
            fragment.vx = 0;
            fragment.vy = 0;
            fragment.opacity = 0.9;
            fragment.memoryOpacity = 0.9;
            continue;
          }

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
          const resonance = evaluateNodeTheoryResonance(fragment, { minScore: 1.7 });
          fragment.theoryValidationScore = resonance.score;
          fragment.theoryDimensions = resonance.activatedDimensions;

          if ((fragment.age || 0) < 6) {
            fragment.phase = "formation";
          } else if ((fragment.theoryResonanceScore || 0) + (fragment.semanticDensity || 0) >= 1.1) {
            fragment.phase = "stabilization";
          } else {
            fragment.phase = "transformation";
          }

          if (resonance.reject && (fragment.age || 0) > 14) {
            fragment.opacity = clamp((fragment.opacity ?? 0.8) - 0.04, 0.08, 1);
            fragment.memoryOpacity = clamp((fragment.memoryOpacity ?? 0.7) - 0.04, 0.08, 1);
          }
        }

        draft.nodes = draft.nodes.filter((node) => {
          if (isAnchorNode(node)) {
            return true;
          }
          if ((node.age || 0) < 18) {
            return true;
          }
          return (node.theoryValidationScore || 0) >= 1.5 || (node.opacity ?? 0.5) > 0.18;
        });

        if (now >= draft.nextRelationAt) {
          refreshGraphTopology(draft);
          draft.nextRelationAt = now + RELATION_INTERVAL;
        }

        if (now >= draft.nextWikiAt) {
          void this.ingestWikipediaPulse();
          draft.nextWikiAt = now + WIKI_INTERVAL;
        }

        advanceForceSimulation(draft, now, delta);
        trimNodeField(draft);
        draft.categories = refreshCategories(draft, now);
        scheduleGraphStateSave(draft);
      });
    },
  };
}

export { createGraphStore, createInitialGraphState, graphStore } from "./graphState.js";
