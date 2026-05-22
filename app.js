import { createCanvasStage } from "./core/canvas.js";
import { renderScene } from "./core/renderer.js";
import { createFoundationState } from "./core/layout.js";
import { updateFragments } from "./core/movement.js";
import { updateSpatialMemory } from "./core/spatialMemory.js";
import { buildRelations, updateRelationLayer } from "./core/relations.js";
import { loadTheoryCorpus, flattenLines } from "./modules/theoryLoader.js";
import { extractFoundationTerms } from "./modules/semanticExtractor.js";
import { fetchWikipediaEntry } from "./modules/wikipedia.js";

const WIKI_TOPICS = [
  "Soziale Plastik",
  "Joseph Beuys",
  "Raum",
  "Architektur",
  "Gesellschaft",
  "Handlung",
  "Bewegung",
  "Verdichtung",
  "Praxis",
  "Kunst als Erfahrung",
  "Kunst als menschliche Praxis",
];

const MAX_FEED_LINES = 72;
const FEED_INTERVAL = 420;
const EXTRACTION_INTERVAL = 2600;
const RELATION_INTERVAL = 4200;
const WIKI_INTERVAL = 7500;

const canvas = document.getElementById("scene");

if (!canvas) {
  throw new Error("Canvas-Element nicht gefunden.");
}

const stage = createCanvasStage(canvas);
const context = stage.context;

const state = {
  viewport: stage.getViewport(),
  corpus: [],
  ingestionQueue: [],
  transformationQueue: [],
  feedQueue: [],
  feedLines: [],
  baseTerms: [],
  termKeys: new Set(),
  fragments: [],
  relations: [],
  wikiEntries: [],
  wikiSeed: [],
  foundationState: createFoundationState(stage.getViewport()),
  lastFrameAt: performance.now(),
  nextFeedAt: 0,
  nextExtractionAt: 0,
  nextRelationAt: 0,
  nextWikiAt: 0,
  wikiCursor: 0,
  feedSpeed: 16,
  running: true,
  nextTransformationAt: 0,
};

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

function buildFeedEntries(corpus) {
  return flattenLines(corpus).map((entry, index) => ({
    id: `feed-${index}-${normalizeKey(entry.text)}`,
    source: entry.source || "theorie",
    text: entry.text,
    age: 0,
    opacity: 0.92,
    y: 0,
  }));
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

function rebuildSeedRelations() {
  const fragmentIndex = new Map();
  state.fragments.forEach((fragment, index) => {
    fragmentIndex.set(normalizeKey(fragment.keyword || fragment.text), index);
    fragmentIndex.set(normalizeKey(fragment.text), index);
  });

  const now = performance.now();
  const seedRelations = [];

  for (const seed of state.wikiSeed) {
    const leftIndex = fragmentIndex.get(normalizeKey(seed.source));
    const rightIndex = fragmentIndex.get(normalizeKey(seed.target));
    if (leftIndex === undefined || rightIndex === undefined || leftIndex === rightIndex) {
      continue;
    }

    seedRelations.push({
      leftIndex,
      rightIndex,
      score: 1 + (seed.weight || 0),
      type: "semantic",
      label: seed.label || `${seed.source} / ${seed.target}`,
      bornAt: now,
      ttl: 14000,
      opacity: 0.14 + (seed.weight || 0) * 0.06,
    });
  }

  state.relations = [...seedRelations, ...buildRelations(state.fragments, state.wikiEntries, now)];
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

async function loadInitialData() {
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
  state.ingestionQueue = [...state.feedQueue];
  state.wikiSeed = Array.isArray(wikiSeed) ? wikiSeed : [];

  state.nextTransformationAt = performance.now() + 600;
}

async function loadWikipediaPulse() {
  if (state.wikiCursor >= WIKI_TOPICS.length) {
    state.wikiCursor = 0;
  }

  const term = WIKI_TOPICS[state.wikiCursor];
  state.wikiCursor += 1;

  try {
    const entry = await fetchWikipediaEntry(term);
    if (!entry) {
      return;
    }

    state.wikiEntries = [entry, ...state.wikiEntries].slice(0, 6);
    const summaryLine = entry.summary ? `${entry.title}: ${entry.summary}` : entry.title;
    state.ingestionQueue.push({
      id: `wiki-${normalizeKey(entry.title)}-${Date.now()}`,
      source: entry.title,
      text: summaryLine,
      rawText: entry.summary || entry.title,
      category: entry.title,
      phase: "ingestion",
      age: 0,
      opacity: 0.94,
    });
  } catch {
    return;
  }
}

function resize() {
  stage.resize();
  state.viewport = stage.getViewport();

  state.foundationState = createFoundationState(state.viewport);
  state.fragments = state.fragments.map((fragment) => {
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
  for (const fragment of state.fragments) {
    if (Number.isInteger(fragment.lane) && fragment.lane >= 0 && fragment.lane <= 2) {
      state.foundationState.laneCounts[fragment.lane] += 1;
    }
  }

  rebuildSeedRelations();
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
        state.fragments.push(createTransformationFragment(nextTerm, state.fragments.length));
      }
      state.nextTransformationAt = now + 480;
    }

    const semanticCounts = new Map();
    for (const fragment of state.fragments) {
      const key = fragment.semanticGroup || fragment.category || fragment.role || "general";
      semanticCounts.set(key, (semanticCounts.get(key) || 0) + 1);
    }

    for (const fragment of state.fragments) {
      fragment.age = (fragment.age || 0) + delta / 1000;
      const groupKey = fragment.semanticGroup || fragment.category || fragment.role || "general";
      const groupCount = semanticCounts.get(groupKey) || 0;
      const relationDensity = state.relations.filter((relation) => {
        const left = state.fragments[relation.leftIndex];
        const right = state.fragments[relation.rightIndex];
        return left && right && (left.semanticGroup === groupKey || right.semanticGroup === groupKey);
      }).length;

      if (fragment.phase !== "foundation" && groupCount >= 3 && relationDensity >= 2 && fragment.age > 6) {
        fragment.phase = "foundation";
        fragment.depthLayer = 2;
        fragment.text = String(fragment.semanticGroup || fragment.category || fragment.text || fragment.keyword || "KATEGORIE").toUpperCase();
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
      rebuildSeedRelations();
      state.nextRelationAt = now + RELATION_INTERVAL;
    }

    if (now >= state.nextWikiAt) {
      void loadWikipediaPulse();
      state.nextWikiAt = now + WIKI_INTERVAL;
    }

    updateFragments(state.fragments, state.relations, state.viewport, now, delta);
    updateSpatialMemory(state.fragments, delta);
    state.relations = updateRelationLayer(state.relations, now);

    try {
      renderScene(context, state.viewport, state.fragments, state.relations, state.feedLines);
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

window.addEventListener("resize", resize, { passive: true });

bootstrap().catch((error) => {
  console.error("Handlungsraum konnte nicht gestartet werden.", error);
});