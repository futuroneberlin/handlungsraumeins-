import { fetchWikipediaEntry } from "../../modules/wikipedia.js";
import { mergeUniqueStrings, nodeIdentity } from "./graphState.js";
import { createSemanticFragment, createConceptExcerpt, extractKeywords } from "../../modules/textFragmenter.js";
import { curateSemanticSignals, evaluateTheoryResonance } from "../../core/theoryModel.js";

export function buildFeedEntries(corpus) {
  return (Array.isArray(corpus) ? corpus : []).flatMap((entry) => {
    const text = String(entry.text || "");
    const fragments = text
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4);

    return fragments.map((part) => {
      const fragment = createSemanticFragment(part, { source: entry.source || "theory", excerptWords: 16, keywordLimit: 4 });
      const evaluation = evaluateTheoryResonance([
        entry.title,
        fragment.excerpt,
        ...(fragment.keywords || []),
      ], { minScore: 1.95 });
      if (evaluation.reject) {
        return null;
      }

      const curated = curateSemanticSignals([
        entry.title,
        fragment.excerpt,
        ...(fragment.keywords || []),
      ], { minScore: 1.12 });
      if (!curated.length) {
        return null;
      }

      const concepts = [...new Set(curated.map((item) => item.signal))].slice(0, 4);

      return {
        ...fragment,
        title: entry.title || fragment.title,
        text: fragment.excerpt,
        excerpt: fragment.excerpt,
        concept: concepts[0] || fragment.concept,
        concepts,
        theoryRelevance: Number(evaluation.score || 0),
        activatedDimensions: evaluation.activatedDimensions || [],
        age: 0,
        opacity: 0.92,
        y: 0,
      };
    }).filter(Boolean);
  }).map((entry, index) => ({
    id: `feed-${index}-${String(entry.excerpt || entry.text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")}`,
    source: entry.source || "theory",
    title: entry.title || entry.source || "Fragment",
    excerpt: entry.excerpt || entry.text || "",
    keywords: entry.concepts || entry.keywords || [],
    concept: entry.concept || entry.title || entry.source || "Fragment",
    concepts: entry.concepts || [],
    text: entry.excerpt || entry.text || "",
    theoryRelevance: Number(entry.theoryRelevance || 0),
    activatedDimensions: entry.activatedDimensions || [],
    age: 0,
    opacity: 0.92,
    y: 0,
  })).filter((entry) => entry.theoryRelevance >= 1.95);
}

export function createWikipediaNode(entry, viewport, existingCount = 0) {
  const width = viewport.width || 1280;
  const height = viewport.height || 800;
  const categories = Array.isArray(entry.categories) ? entry.categories : [];
  const links = Array.isArray(entry.links) ? entry.links : [];
  const title = String(entry.title || entry.term || "Wikipedia Concept").trim();
  const summary = String(entry.summary || "").trim();
  const primaryCategory = categories[0] || "Wikipedia";
  const summaryExcerpt = createConceptExcerpt(summary || title, 18);
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
