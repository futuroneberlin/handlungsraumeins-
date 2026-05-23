import { fetchWikipediaEntry } from "../../modules/wikipedia.js";
import { mergeUniqueStrings, nodeIdentity } from "./graphState.js";

export function buildFeedEntries(corpus) {
  return (Array.isArray(corpus) ? corpus : []).flatMap((entry) => {
    const text = String(entry.text || "");
    return text
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => ({ source: entry.source || "theory", text: part }));
  }).map((entry, index) => ({
    id: `feed-${index}-${String(entry.text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")}`,
    source: entry.source || "theory",
    text: entry.text,
    age: 0,
    opacity: 0.92,
    y: 0,
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
  const relevance = 1 + Math.min(1.2, categories.length * 0.08 + links.length * 0.01);

  return {
    id: `wiki-${String(nodeIdentity({ id: title }) || title).toLowerCase()}`,
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

  for (const link of node?.wikiLinks || []) {
    terms.add(link);
  }

  return [...terms].slice(0, 4);
}

export async function loadWikipediaPulse(term) {
  return fetchWikipediaEntry(term);
}
