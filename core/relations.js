import { explainTheoryConnection, theoryAffinity } from "./theoryModel.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTokenList(values = []) {
  return [...new Set(values
    .flat()
    .map((value) => String(value || "").toLowerCase().trim())
    .map((value) => value.replace(/^category:/i, ""))
    .filter(Boolean))];
}

function overlap(leftValues = [], rightValues = []) {
  const rightSet = new Set(normalizeTokenList(rightValues));
  return normalizeTokenList(leftValues).filter((value) => rightSet.has(value));
}

function relationScore(left, right) {
  const leftKeywords = normalizeTokenList([left.keywords || [], left.keyword, left.text, left.title]);
  const rightKeywords = normalizeTokenList([right.keywords || [], right.keyword, right.text, right.title]);
  const sharedKeywords = overlap(leftKeywords, rightKeywords);
  const sharedCategories = overlap(left.wikiCategories || left.categories || [], right.wikiCategories || right.categories || []);
  const sharedLinks = overlap(left.wikiLinks || [], right.wikiLinks || []);
  const leftIndex = Number.isFinite(left.index) ? left.index : Number.isFinite(left.sequenceIndex) ? left.sequenceIndex : 0;
  const rightIndex = Number.isFinite(right.index) ? right.index : Number.isFinite(right.sequenceIndex) ? right.sequenceIndex : 0;
  const proximityScore = Math.max(0, 1 - Math.abs(leftIndex - rightIndex) / 24);
  const sourceScore = left.source === right.source ? 0.25 : 0;
  const sharedScore = sharedKeywords.length * 0.86;
  const categoryScore = sharedCategories.length * 1.25;
  const linkScore = sharedLinks.length * 1.1;
  const massScore = Math.min(left.weight || 0.5, right.weight || 0.5) * 0.45;
  const groupLeft = left.semanticGroup || null;
  const groupRight = right.semanticGroup || null;
  const groupScore = groupLeft && groupRight && groupLeft === groupRight ? 0.62 : 0;
  const bridgePairs = new Set([
    "Raum|Konstruktion",
    "Konstruktion|Raum",
    "Handlung|Gesellschaft",
    "Gesellschaft|Handlung",
    "Handlung|Kunst",
    "Kunst|Handlung",
    "Kunst|Gesellschaft",
    "Gesellschaft|Kunst",
  ]);
  const bridgeScore = bridgePairs.has(`${groupLeft}|${groupRight}`) ? 0.34 : 0;
  const theoryLeft = theoryAffinity(left);
  const theoryRight = theoryAffinity(right);
  const theoryBoost = Math.min(1.8, (theoryLeft + theoryRight) * 0.22);
  const repetitionScore = Math.min(1.2, Math.min(left.appearanceCount || 1, right.appearanceCount || 1) * 0.12);
  return {
    score: sharedScore + categoryScore + linkScore + proximityScore + sourceScore + massScore + groupScore + bridgeScore + theoryBoost + repetitionScore,
    sharedKeywords,
    sharedCategories,
    sharedLinks,
    theoryBoost,
    repetitionScore,
  };
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function uniqueBy(list, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of list) {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function tokenKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function createSemanticEdges(nodes, wikiEntries = [], timestamp = now()) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const edges = [];

  for (let leftIndex = 0; leftIndex < safeNodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < safeNodes.length; rightIndex += 1) {
      const left = safeNodes[leftIndex];
      const right = safeNodes[rightIndex];
      const { score, sharedKeywords, sharedCategories, sharedLinks, theoryBoost, repetitionScore } = relationScore(left, right);
      const sameCategory = sharedCategories.length > 0 && String(left.semanticGroup || left.category || "").toLowerCase() === String(right.semanticGroup || right.category || "").toLowerCase();
      const sequentialBoost = rightIndex === leftIndex + 1 ? 0.22 : 0;
      const proximityBoost = left.phase === right.phase ? 0.08 : 0;
      const adjustedScore = score + sequentialBoost + proximityBoost;

      if (adjustedScore < 0.9) {
        continue;
      }

      const type = sharedKeywords.length > 1
        ? "semantic"
        : sameCategory
          ? "category"
          : left.clusterKey === right.clusterKey
            ? "drift"
            : "semantic";
      const ttl = type === "wiki" ? 6800 : type === "drift" ? 9800 : 16000;
      const confidence = clamp((adjustedScore / 5.2) + Math.min(0.18, theoryBoost * 0.08) + Math.min(0.12, repetitionScore * 0.06), 0.16, 0.98);
      const explanation = explainTheoryConnection({ sharedKeywords, sharedCategories, sharedLinks, theoryBoost, repetitionScore, left, right });

      edges.push({
        id: `${left.id || leftIndex}-${right.id || rightIndex}`,
        source: left.id ?? `node-${leftIndex}`,
        target: right.id ?? `node-${rightIndex}`,
        sourceIndex: leftIndex,
        targetIndex: rightIndex,
        leftIndex,
        rightIndex,
        score: adjustedScore,
        weight: adjustedScore,
        confidence,
        type,
        label: sharedKeywords[0] || left.semanticGroup || right.semanticGroup || null,
        keywords: sharedKeywords,
        sharedCategories,
        sharedLinks,
        explanation,
        bornAt: timestamp,
        ttl,
      });
    }
  }

  for (const entry of Array.isArray(wikiEntries) ? wikiEntries : []) {
    const term = tokenKey(entry.title || entry.term || "");
    if (!term) {
      continue;
    }

    const matches = safeNodes.filter((node) => {
      const keywords = Array.isArray(node.keywords) ? node.keywords : [];
      return keywords.some((keyword) => term.includes(tokenKey(keyword)) || tokenKey(keyword).includes(term));
    });

    for (let index = 0; index < Math.min(2, matches.length - 1); index += 1) {
      edges.push({
        id: `${matches[index].id || index}-${matches[index + 1].id || index + 1}-wiki-${term}`,
        source: matches[index].id ?? `node-${safeNodes.indexOf(matches[index])}`,
        target: matches[index + 1].id ?? `node-${safeNodes.indexOf(matches[index + 1])}`,
        sourceIndex: safeNodes.indexOf(matches[index]),
        targetIndex: safeNodes.indexOf(matches[index + 1]),
        leftIndex: safeNodes.indexOf(matches[index]),
        rightIndex: safeNodes.indexOf(matches[index + 1]),
        score: 1.18,
        weight: 1.18,
        confidence: 0.88,
        type: "wiki",
        label: entry.title || term,
        keywords: [term],
        explanation: `Linked through live Wikipedia knowledge about ${entry.title || term}`,
        bornAt: timestamp,
        ttl: 5400,
      });
    }
  }

  return uniqueBy(edges, (edge) => edge.id)
    .filter((relation) => relation.leftIndex >= 0 && relation.rightIndex >= 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(64, safeNodes.length * 2));
}

export function createEmergentCategories(nodes, edges = [], timestamp = now()) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const buckets = new Map();

  for (const node of safeNodes) {
    const key = String(node.semanticGroup || node.category || node.role || node.keyword || "allgemein");
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: `category-${tokenKey(key) || safeNodes.indexOf(node)}`,
        label: key,
        keywords: new Set(),
        nodeIds: new Set(),
        weight: 0,
        edgeCount: 0,
        edgeWeight: 0,
        emergedAt: timestamp,
      });
    }

    const bucket = buckets.get(key);
    bucket.nodeIds.add(node.id || `node-${safeNodes.indexOf(node)}`);
    bucket.weight += Number.isFinite(node.weight) ? node.weight : 1;
    for (const keyword of node.keywords || []) {
      bucket.keywords.add(String(keyword));
    }
  }

  for (const edge of safeEdges) {
    const left = safeNodes[edge.leftIndex ?? edge.sourceIndex ?? -1];
    const right = safeNodes[edge.rightIndex ?? edge.targetIndex ?? -1];
    if (!left || !right) {
      continue;
    }

    const leftKey = String(left.semanticGroup || left.category || left.role || left.keyword || "allgemein");
    const rightKey = String(right.semanticGroup || right.category || right.role || right.keyword || "allgemein");
    for (const key of [leftKey, rightKey]) {
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.edgeCount += 1;
        bucket.edgeWeight += Number(edge.confidence || edge.weight || edge.score || 1);
      }
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const nodeCount = bucket.nodeIds.size;
      const keywordList = [...bucket.keywords];
      const weightedDensity = nodeCount > 1 ? bucket.edgeWeight / nodeCount : bucket.edgeWeight;
      const stable = nodeCount >= 3 && weightedDensity >= 0.9;
      return {
        id: bucket.id,
        label: bucket.label,
        keywords: keywordList.slice(0, 6),
        nodeCount,
        edgeCount: bucket.edgeCount,
        density: Number(weightedDensity.toFixed(2)),
        stable,
        weight: Number((bucket.weight / Math.max(1, nodeCount)).toFixed(2)),
        nodeIds: [...bucket.nodeIds],
        emergedAt: bucket.emergedAt,
      };
    })
    .filter((category) => category.stable || category.nodeCount >= 2)
    .sort((left, right) => right.nodeCount - left.nodeCount || right.density - left.density)
    .slice(0, 12);
}

export function buildRelations(fragments, wikiEntries = [], timestamp = now()) {
  return createSemanticEdges(fragments, wikiEntries, timestamp);
}

export function updateRelationLayer(relations, timestamp = now()) {
  return relations
    .map((relation) => {
      const age = timestamp - relation.bornAt;
      const progress = Math.max(0, 1 - age / relation.ttl);
      const wobble = relation.type === "wiki" ? 1 : relation.type === "drift" ? 0.84 : 0.92;
      const typeAlpha = relation.type === "wiki" ? 0.42 : relation.type === "drift" ? 0.34 : 0.3;
      return {
        ...relation,
        age,
        progress,
        opacity: progress * typeAlpha * wobble,
      };
    })
    .filter((relation) => relation.progress > 0.14);
}
