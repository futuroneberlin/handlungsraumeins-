import { fetchWikipediaEntry } from "../../modules/wikipedia.js";
import { mergeUniqueStrings, nodeIdentity } from "./graphState.js";
import { createConceptExcerpt, extractKeywords } from "../../modules/textFragmenter.js";
import { curateSemanticSignals, evaluateTheoryResonance } from "../../core/theoryModel.js";

const ALLOWED_THEME_TERMS = [
  "joseph beuys",
  "social sculpture",
  "process art",
  "participatory art",
  "relational aesthetics",
  "architecture",
  "space",
  "embodiment",
  "temporality",
  "collective practice",
  "aesthetic experience",
  "john dewey",
  "georg w bertram",
  "sculpture",
  "performance",
  "ritual",
  "urban practice",
  "spatial theory",
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function matchesAllowedTheme(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.length > 0 && ALLOWED_THEME_TERMS.some((term) => normalized.includes(term));
}

function extractConceptualSentences(text, maxSentences = 2, maxWords = 42) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return "";
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => /\b(participat|collective|process|tempor|spatial|space|embod|action|relation|sculpt|practice|experience|interaction|ritual|urban|public)\b/i.test(sentence))
    .slice(0, maxSentences);

  const selected = (sentences.length ? sentences : normalized.split(/(?<=[.!?])\s+/).slice(0, maxSentences)).join(" ");
  return selected.split(/\s+/).slice(0, maxWords).join(" ");
}

function createSourceMeta(entry) {
  return [
    entry.pageid ? `page ${entry.pageid}` : null,
    entry.url ? "Wikipedia live API" : null,
    Array.isArray(entry.categories) && entry.categories.length ? `categories ${entry.categories.slice(0, 4).join(" · ")}` : null,
    Array.isArray(entry.links) && entry.links.length ? `links ${entry.links.slice(0, 4).join(" · ")}` : null,
  ].filter(Boolean).join(" | ");
}

function stageDelay(index) {
  return 4500 + index * 5200;
}

function createStagedIngestionItem(entry, index = 0) {
  const summary = normalizeText(entry.summary || entry.excerpt || "");
  const excerpt = extractConceptualSentences(summary, 1, 26);
  if (!excerpt) {
    return null;
  }

  const evaluation = evaluateTheoryResonance([
    entry.title,
    excerpt,
    ...(entry.concepts || []),
    ...(entry.categories || []),
  ], { minScore: 1.65 });

  if (evaluation.reject && !(matchesAllowedTheme(entry.title) || matchesAllowedTheme(summary))) {
    return null;
  }

  const curated = curateSemanticSignals([
    entry.title,
    excerpt,
    ...(entry.concepts || []),
  ], { minScore: 1.08 }).slice(0, 4);

  const concepts = curated.length ? [...new Set(curated.map((item) => item.signal))] : (entry.concepts || []).slice(0, 5);
  const physics = entry.semanticPhysics || {};

  return {
    id: `ingestion-${String(entry.pageid || entry.title || index).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}-${index}`,
    nodeId: entry.nodeId || null,
    source: "Wikipedia live API",
    title: entry.title || "Wikipedia article",
    text: excerpt,
    excerpt,
    sourceMeta: createSourceMeta(entry),
    sourceUrl: entry.url || "",
    pageid: entry.pageid || null,
    keywords: concepts.slice(0, 4),
    concept: concepts[0] || entry.title || "Wikipedia article",
    concepts,
    activatedDimensions: evaluation.activatedDimensions || entry.theoryDimensions || [],
    semanticPhysics: physics,
    theoryRelevance: Number(evaluation.score || entry.resonanceScore || 0),
    stage: index === 0 ? "arrival" : "queued",
    revealAt: performance.now() + stageDelay(index),
    age: 0,
    opacity: 0.92,
  };
}

export function buildFeedEntries(corpus) {
  return (Array.isArray(corpus) ? corpus : [])
    .filter((entry) => entry && (matchesAllowedTheme(entry.title) || matchesAllowedTheme(entry.summary) || matchesAllowedTheme(entry.excerpt) || (Array.isArray(entry.categories) && entry.categories.some(matchesAllowedTheme))))
    .map((entry, index) => createStagedIngestionItem(entry, index))
    .filter(Boolean)
    .filter((entry) => Number(entry.theoryRelevance || 0) >= 1.12)
    .sort((left, right) => (right.theoryRelevance || 0) - (left.theoryRelevance || 0))
    .map((entry, index) => ({
      ...entry,
      stageIndex: index,
      revealAt: performance.now() + stageDelay(index),
    }));
}

export function createWikipediaNode(entry, viewport, existingCount = 0) {
  const width = viewport.width || 1280;
  const height = viewport.height || 800;
  const categories = Array.isArray(entry.categories) ? entry.categories : [];
  const links = Array.isArray(entry.links) ? entry.links : [];
  const title = String(entry.title || entry.term || "Wikipedia Concept").trim();
  const summary = String(entry.summary || "").trim();
  const primaryCategory = categories[0] || "Wikipedia";
  const summaryExcerpt = extractConceptualSentences(summary || title, 2, 24) || createConceptExcerpt(summary || title, 18);
  const summaryKeywords = extractKeywords(summary || title, 5);
  const conceptKeywords = mergeUniqueStrings(
    [title],
    entry.concepts || [],
    summaryKeywords,
    categories.slice(0, 4),
    links.slice(0, 6),
  );
  const curatedConcepts = Array.isArray(entry.curated)
    ? entry.curated.map((item) => item.signal).slice(0, 8)
    : conceptKeywords.slice(0, 8);
  const evaluation = evaluateTheoryResonance([
    title,
    summaryExcerpt,
    ...curatedConcepts,
  ], { minScore: 1.95 });
  const resonanceScore = Number(entry.resonanceScore || 0);
  const relevance = 1 + Math.min(1.2, categories.length * 0.08 + links.length * 0.01);

  return {
    id: `wiki-${String(nodeIdentity({ id: title }) || title).toLowerCase()}`,
    text: title,
    keyword: title,
    title,
    source: title,
    wikiTitle: title,
    wikiSummary: summaryExcerpt,
    sourceMeta: createSourceMeta(entry),
    abstract: summaryExcerpt,
    wikiUrl: entry.url || "",
    wikiCategories: categories,
    wikiLinks: links,
    keywords: curatedConcepts,
    concepts: curatedConcepts.slice(0, 6),
    semanticWeights: Object.fromEntries(curatedConcepts.slice(0, 6).map((keyword, index) => [keyword, Number((1.08 - index * 0.11).toFixed(3))])),
    semanticLabel: curatedConcepts[0] || title,
    semanticSignature: `${String(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}`,
    theoryResonanceScore: Math.min(1, 0.28 + resonanceScore * 0.24 + Math.min(0.64, evaluation.score * 0.18)),
    theoryDimensions: evaluation.activatedDimensions,
    theoryValidationScore: evaluation.score,
    semanticDensity: Math.min(1, curatedConcepts.length / 6),
    relationCandidates: [],
    abstract: summaryExcerpt,
    category: primaryCategory,
    semanticGroup: primaryCategory,
    role: categories.length > 3 ? "central" : "secondary",
    phase: "ingestion",
    x: width * 0.12,
    y: height * (0.22 + ((existingCount % 6) * 0.08)),
    targetX: width * 0.5,
    targetY: height * 0.46,
    anchorX: width * 0.5,
    anchorY: height * 0.46,
    clusterCenterX: width * 0.5,
    clusterCenterY: height * 0.46,
    depthLayer: 1,
    lane: 1,
    rowIndex: existingCount,
    mass: relevance,
    weight: relevance,
    layoutWidth: Math.max(240, Math.min(360, width * 0.24)),
    sizeScale: 1,
    opacity: 0.94,
    memoryOpacity: 0.76,
    semanticPhysics: entry.semanticPhysics || {},
    appearanceCount: 1,
    lastSeenAt: performance.now(),
    firstSeenAt: performance.now(),
  };
}

export function collectExpansionTopics(node) {
  const terms = new Set();
  for (const keyword of node?.keywords || []) {
    const normalized = String(keyword || "").trim();
    if (normalized) {
      terms.add(normalized);
    }
  }

  if (node?.semanticGroup) {
    terms.add(node.semanticGroup);
  }
  if (node?.category) {
    terms.add(node.category);
  }
  if (node?.source) {
    terms.add(node.source);
  }

  for (const category of node?.wikiCategories || []) {
    terms.add(category);
  }

  for (const concept of node?.concepts || []) {
    terms.add(concept);
  }

  for (const candidate of node?.relationCandidates || []) {
    if (candidate?.label) {
      terms.add(candidate.label);
    }
  }

  for (const link of node?.wikiLinks || []) {
    terms.add(link);
  }

  return [...terms].slice(0, 4);
}

export async function loadWikipediaPulse(term) {
  return fetchWikipediaEntry(term);
}
