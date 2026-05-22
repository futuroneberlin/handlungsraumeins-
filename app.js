import { createCanvasStage } from "./core/canvas.js";
import { renderScene } from "./core/renderer.js";
import { createFoundationState, layoutFragments, placeFoundationFragment } from "./core/layout.js";
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

function seedFeed(lines) {
  for (const line of lines.slice(0, 18)) {
    addFeedLine(line);
  }
}

function appendFoundationTerms(candidates) {
  let appended = false;

  for (const term of candidates) {
    const normalized = normalizeKey(term.text || term.keyword);
    if (!normalized || state.termKeys.has(normalized)) {
      continue;
    }

    state.termKeys.add(normalized);
    const fragment = {
      ...term,
      id: normalized,
      keyword: term.keyword || term.text,
      text: String(term.text || term.keyword || normalized).toUpperCase(),
      source: term.source || "theorie",
      age: 0,
      opacity: term.opacity ?? 0.92,
      memoryOpacity: term.memoryOpacity ?? 0.72,
    };

    state.baseTerms.push(fragment);
    const placed = placeFoundationFragment(fragment, state.baseTerms.length - 1, state.viewport, state.foundationState);
    state.fragments.push(placed);
    appended = true;
  }

  if (appended) {
    rebuildSeedRelations();
  }
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
  state.wikiSeed = Array.isArray(wikiSeed) ? wikiSeed : [];

  seedFeed(state.feedQueue);

  const initialTerms = extractFoundationTerms(mergedCorpus, 16);
  appendFoundationTerms(initialTerms);
  rebuildSeedRelations();
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
    addFeedLine({
      id: `wiki-${normalizeKey(entry.title)}`,
      source: entry.title,
      text: summaryLine,
      age: 0,
      opacity: 0.96,
      y: state.viewport.height - 48,
    });

    const theoryWindow = [
      ...state.corpus.slice(-8),
      ...state.feedLines.slice(-12).map((line) => ({ source: line.source, text: line.text })),
    ];
    const extracted = extractFoundationTerms(theoryWindow, 18);
    appendFoundationTerms(extracted);
    rebuildSeedRelations();
  } catch {
    return;
  }
}

function resize() {
  stage.resize();
  state.viewport = stage.getViewport();

  const previousFragments = new Map(state.fragments.map((fragment) => [fragment.id, fragment]));
  state.foundationState = createFoundationState(state.viewport);
  state.fragments = layoutFragments(state.baseTerms, state.viewport).map((fragment) => {
    const previous = previousFragments.get(fragment.id);
    if (!previous) {
      return fragment;
    }

    return {
      ...fragment,
      x: previous.x,
      y: previous.y,
      vx: previous.vx || 0,
      vy: previous.vy || 0,
      age: previous.age || fragment.age,
      opacity: previous.opacity || fragment.opacity,
      memoryOpacity: previous.memoryOpacity || fragment.memoryOpacity,
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

  const delta = Math.min(48, now - state.lastFrameAt || 16.67);
  state.lastFrameAt = now;

  if (now >= state.nextFeedAt && state.feedQueue.length) {
    const nextLine = state.feedQueue.shift();
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
      ...state.feedLines.slice(-16).map((line) => ({ source: line.source, text: line.text })),
    ];
    const newTerms = extractFoundationTerms(windowCorpus, 18);
    appendFoundationTerms(newTerms);
    state.nextExtractionAt = now + EXTRACTION_INTERVAL;
  }

  if (now >= state.nextRelationAt) {
    rebuildSeedRelations();
    state.nextRelationAt = now + RELATION_INTERVAL;
  }

  if (now >= state.nextWikiAt) {
    void loadWikipediaPulse();
    state.nextWikiAt = now + WIKI_INTERVAL;
  }

  updateFragments(state.fragments, state.viewport, now, delta);
  updateSpatialMemory(state.fragments, delta);
  state.relations = updateRelationLayer(state.relations, now);

  renderScene(context, state.viewport, state.fragments, state.relations, state.feedLines);

  requestAnimationFrame(tick);
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