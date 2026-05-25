import { theoryAffinity, theoryResonanceTerms, stabilizeTheoryStatement } from "./theoryModel.js";

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

function tokenize(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && part.length > 2 && !["the", "and", "for", "with", "from", "that", "this", "into", "over", "about"].includes(part));
}

function collectSignals(node) {
  return normalizeTokenList([
    node?.keywords || [],
    node?.keyword,
    node?.text,
    node?.title,
    node?.wikiSummary,
    node?.wikiCategories || node?.categories || [],
    node?.wikiLinks || [],
    node?.category,
    node?.semanticGroup,
    node?.role,
  ]);
}

function overlap(leftValues = [], rightValues = []) {
  const rightSet = new Set(normalizeTokenList(rightValues));
  return normalizeTokenList(leftValues).filter((value) => rightSet.has(value));
}

function relationScore(left, right) {
  const leftVector = left?.conceptVector || buildConceptVector(left);
  const rightVector = right?.conceptVector || buildConceptVector(right);
  const sharedConcepts = sharedConceptOverlap(leftVector, rightVector);
  const leftKeywords = collectSignals(left);
  const rightKeywords = collectSignals(right);
  const sharedKeywords = overlap(leftKeywords, rightKeywords);
  const sharedCategories = overlap(left.wikiCategories || left.categories || [], right.wikiCategories || right.categories || []);
  const sharedLinks = overlap(left.wikiLinks || [], right.wikiLinks || []);
  const leftTokens = normalizeTokenList(leftKeywords.flatMap((value) => tokenize(value)));
  const rightTokens = normalizeTokenList(rightKeywords.flatMap((value) => tokenize(value)));
  const sharedTokens = overlap(leftTokens, rightTokens);
  const leftTheorySignals = theoryResonanceTerms(left);
  const rightTheorySignals = theoryResonanceTerms(right);
  const sharedTheorySignals = overlap(leftTheorySignals, rightTheorySignals);
  const leftIndex = Number.isFinite(left.index) ? left.index : Number.isFinite(left.sequenceIndex) ? left.sequenceIndex : 0;
  const rightIndex = Number.isFinite(right.index) ? right.index : Number.isFinite(right.sequenceIndex) ? right.sequenceIndex : 0;
  const proximityScore = Math.max(0, 1 - Math.abs(leftIndex - rightIndex) / 24);
  const laneScore = left.lane === right.lane ? 0.24 : 0;
  const phaseScore = left.phase === right.phase ? 0.2 : 0;
  const sourceScore = left.source === right.source ? 0.25 : 0;
  const sharedScore = sharedKeywords.length * 0.82;
  const tokenScore = sharedTokens.length * 0.32;
  const categoryScore = sharedCategories.length * 1.18;
  const linkScore = sharedLinks.length * 1.06;
  const massScore = Math.min(left.weight || 0.5, right.weight || 0.5) * 0.45;
  const groupLeft = left.semanticGroup || null;
  const groupRight = right.semanticGroup || null;
  const groupScore = groupLeft && groupRight && groupLeft === groupRight ? 0.72 : 0;
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
  const theoryBoost = Math.min(2.2, (theoryLeft + theoryRight) * 0.22 + sharedTheorySignals.length * 0.48);
  const repetitionScore = Math.min(1.2, Math.min(left.appearanceCount || 1, right.appearanceCount || 1) * 0.12);
  const conceptScore = Math.min(2.1, sharedConceptWeight(leftVector, rightVector, sharedConcepts) * 0.48 + sharedConcepts.length * 0.24);
  const semanticSimilarity = Math.min(2.2, (sharedScore * 0.52) + (tokenScore * 0.55) + (categoryScore * 0.3) + (linkScore * 0.22) + conceptScore);
  const contextualProximity = Math.min(1.5, (proximityScore * 1.05) + laneScore + phaseScore + sourceScore * 0.8);
  const narrative = composeRelationNarrative({ left, right, leftVector, rightVector, sharedConcepts, sharedTheorySignals, sharedCategories, sharedLinks, sharedKeywords, theoryBoost, proximityScore: contextualProximity });
  return {
    score: semanticSimilarity + categoryScore + linkScore + contextualProximity + massScore + groupScore + bridgeScore + theoryBoost + repetitionScore,
    semanticStrength: Math.min(1.9, conceptScore + sharedConcepts.length * 0.18 + sharedTheorySignals.length * 0.22 + contextualProximity * 0.26),
    sharedKeywords,
    sharedCategories,
    sharedLinks,
    sharedTokens,
    sharedTheorySignals,
    sharedConcepts,
    theoryBoost,
    repetitionScore,
    contextualProximity,
    leftVector,
    rightVector,
    label: narrative.label,
    explanation: narrative.explanation,
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

function toTitleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function semanticHash(values = []) {
  const input = Array.isArray(values) ? values.flat().map((value) => String(value || "")).join("|") : String(values || "");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeConceptLabel(value) {
  return toTitleCase(String(value || "").replace(/\s+/g, " ").trim());
}

const CONCEPT_TRAITS = [
  { label: "Embodied Collective Action", terms: ["participation", "interaction", "collective", "community", "body", "action", "movement"], group: "Handlung", weight: 1.42 },
  { label: "Temporal Sculptural Transformation", terms: ["temporality", "time", "process", "transformation", "movement", "sequence"], group: "Handlung", weight: 1.36 },
  { label: "Spatial Configuration", terms: ["space", "spatial", "architecture", "structure", "environment", "site"], group: "Raum", weight: 1.32 },
  { label: "Processual Sculpture", terms: ["sculpture", "plastic", "form", "density", "layer", "construction", "formation"], group: "Konstruktion", weight: 1.28 },
  { label: "Relational Public Space", terms: ["relation", "public", "society", "public space", "publicness"], group: "Gesellschaft", weight: 1.24 },
  { label: "Aesthetic Practice", terms: ["art", "practice", "experience", "aesthetic", "practices"], group: "Kunst", weight: 1.18 },
  { label: "Pedagogical Exchange", terms: ["pedagogy", "learning", "teaching", "education", "exchange"], group: "Gesellschaft", weight: 1.16 },
  { label: "Social Sculpture", terms: ["social sculpture", "beuys", "social", "collective creativity"], group: "Gesellschaft", weight: 1.48 },
];

const GROUP_CONCEPTS = new Map([
  ["Raum", "Spatial Configuration"],
  ["Handlung", "Embodied Collective Action"],
  ["Gesellschaft", "Relational Public Space"],
  ["Kunst", "Aesthetic Practice"],
  ["Konstruktion", "Processual Sculpture"],
  ["Theory", "Theory Core Resonance"],
]);

function collectSemanticSignals(node) {
  return normalizeTokenList([
    node?.concepts || [],
    node?.keywords || [],
    node?.wikiCategories || node?.categories || [],
    node?.wikiLinks || [],
    node?.semanticGroup,
    node?.category,
    node?.role,
    node?.title,
    node?.text,
    node?.keyword,
    node?.semanticLabel,
    node?.semanticExcerpt,
    node?.wikiSummary,
  ]);
}

function conceptMatches(signal) {
  const normalized = String(signal || "").toLowerCase();
  const matches = [];

  for (const trait of CONCEPT_TRAITS) {
    const matchedTerms = trait.terms.filter((term) => normalized.includes(term));
    if (!matchedTerms.length) {
      continue;
    }

    matches.push({
      label: trait.label,
      group: trait.group,
      strength: trait.weight + Math.min(0.4, matchedTerms.length * 0.08),
    });
  }

  return matches;
}

function buildConceptVector(node) {
  const signals = collectSemanticSignals(node);
  const weights = new Map();

  for (const signal of signals) {
    for (const match of conceptMatches(signal)) {
      weights.set(match.label, (weights.get(match.label) || 0) + match.strength);
    }
  }

  if (!weights.size) {
    const fallbackConcept = GROUP_CONCEPTS.get(node?.semanticGroup || node?.category || node?.role || "") || normalizeConceptLabel(node?.semanticGroup || node?.category || node?.role || node?.keyword || node?.text || "Conceptual Field");
    weights.set(fallbackConcept, 1);
  }

  const resonanceTerms = theoryResonanceTerms(node);
  for (const term of resonanceTerms) {
    const trait = CONCEPT_TRAITS.find((entry) => entry.terms.some((candidate) => candidate === term || term.includes(candidate) || candidate.includes(term)));
    const label = trait?.label || normalizeConceptLabel(term);
    weights.set(label, (weights.get(label) || 0) + 0.62);
  }

  const ordered = [...weights.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const concepts = ordered.map(([label]) => label);
  const semanticWeights = Object.fromEntries(ordered.map(([label, weight]) => [label, Number(weight.toFixed(3))]));
  const primaryConcept = concepts[0] || normalizeConceptLabel(node?.semanticGroup || node?.category || node?.role || node?.keyword || node?.text || "Conceptual Field");
  const secondaryConcept = concepts[1] || null;
  const signature = semanticHash([primaryConcept, secondaryConcept, ...concepts.slice(2, 6), node?.semanticGroup, node?.category, node?.role]);
  const density = Number(Math.min(1, concepts.length / 6).toFixed(3));
  const theoryResonanceScore = Number(Math.min(1, (theoryAffinity(node) / 8.5) + resonanceTerms.length * 0.05).toFixed(3));

  return {
    signals,
    concepts,
    semanticWeights,
    primaryConcept,
    secondaryConcept,
    signature,
    density,
    theoryResonanceScore,
    resonanceTerms,
  };
}

function decorateSemanticNode(node) {
  if (!node) {
    return node;
  }

  const conceptVector = buildConceptVector(node);
  return {
    ...node,
    concepts: conceptVector.concepts,
    semanticWeights: conceptVector.semanticWeights,
    theoryResonanceScore: conceptVector.theoryResonanceScore,
    semanticDensity: conceptVector.density,
    semanticSignature: conceptVector.signature,
    semanticLabel: node.semanticLabel || conceptVector.primaryConcept || node.title || node.text || node.keyword,
    relationCandidates: Array.isArray(node.relationCandidates) ? node.relationCandidates : [],
    conceptVector,
  };
}

function collectNodeRelations(nodes, edges) {
  const relations = new Map();
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];

  for (const node of safeNodes) {
    relations.set(node.id, []);
  }

  for (const edge of safeEdges) {
    const left = safeNodes[edge.leftIndex ?? edge.sourceIndex ?? -1];
    const right = safeNodes[edge.rightIndex ?? edge.targetIndex ?? -1];
    if (!left || !right) {
      continue;
    }

    const candidate = {
      id: edge.id,
      targetId: right.id,
      label: edge.label,
      score: edge.score ?? edge.weight ?? 0,
      confidence: edge.confidence ?? 0,
      kind: edge.type || "semantic",
      concepts: edge.sharedConcepts || [],
    };

    const reverseCandidate = {
      ...candidate,
      targetId: left.id,
    };

    relations.get(left.id)?.push(candidate);
    relations.get(right.id)?.push(reverseCandidate);
  }

  for (const [nodeId, list] of relations.entries()) {
    list.sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || (right.confidence ?? 0) - (left.confidence ?? 0));
    relations.set(nodeId, list.slice(0, 5));
  }

  return relations;
}

function sharedConceptOverlap(leftVector, rightVector) {
  const rightWeights = rightVector?.semanticWeights || {};
  return (leftVector?.concepts || []).filter((concept) => Object.prototype.hasOwnProperty.call(rightWeights, concept)).sort((left, right) => (rightWeights[right] || 0) - (rightWeights[left] || 0));
}

function sharedConceptWeight(leftVector, rightVector, concepts = []) {
  const leftWeights = leftVector?.semanticWeights || {};
  const rightWeights = rightVector?.semanticWeights || {};
  return concepts.reduce((total, concept) => total + Math.min(leftWeights[concept] || 0, rightWeights[concept] || 0), 0);
}

function selectPrimaryLabel(vector, fallbackValue) {
  return normalizeConceptLabel(vector?.primaryConcept || fallbackValue || "Conceptual Field");
}

function composeRelationNarrative({ left, right, leftVector, rightVector, sharedConcepts = [], sharedTheorySignals = [], sharedCategories = [], sharedLinks = [], sharedKeywords = [], theoryBoost = 0, proximityScore = 0 }) {
  const leftLabel = selectPrimaryLabel(leftVector, left?.semanticLabel || left?.title || left?.keyword || left?.text);
  const rightLabel = selectPrimaryLabel(rightVector, right?.semanticLabel || right?.title || right?.keyword || right?.text);
  const bridge = sharedConcepts[0] || sharedTheorySignals[0] || sharedCategories[0] || sharedLinks[0] || sharedKeywords[0] || null;
  const bridgeLabel = normalizeConceptLabel(bridge || "conceptual proximity");

  if (sharedConcepts.some((concept) => /Embodied Collective Action|Participation|Interaction|Body|Movement/i.test(concept)) || sharedTheorySignals.some((signal) => /participation|interaction|body|movement/i.test(signal))) {
    return {
      label: "Embodied Collective Action",
      explanation: `Participation and collective action converge through embodied interaction between ${leftLabel} and ${rightLabel}.`,
    };
  }

  if (sharedConcepts.some((concept) => /Temporal Sculptural Transformation|Temporal|Process|Transformation|Movement/i.test(concept)) || sharedTheorySignals.some((signal) => /temporality|process|transformation/i.test(signal))) {
    return {
      label: "Temporal Sculptural Transformation",
      explanation: `Temporal process connects ${leftLabel.toLowerCase()} with ${rightLabel.toLowerCase()} through transformation and sequence.`,
    };
  }

  if (sharedConcepts.some((concept) => /Spatial Configuration|Space|Architecture|Structure|Environment/i.test(concept)) || sharedTheorySignals.some((signal) => /space|spatial|architecture|structure/i.test(signal))) {
    return {
      label: "Spatial Activation",
      explanation: `Spatial activation links ${leftLabel.toLowerCase()} with ${rightLabel.toLowerCase()} through structure, environment, and placement.`,
    };
  }

  if (sharedConcepts.some((concept) => /Social Sculpture|Relational Public Space|Collective|Community|Public/i.test(concept)) || sharedTheorySignals.some((signal) => /social sculpture|collective|community|public/i.test(signal))) {
    return {
      label: "Social Sculpture",
      explanation: `Social sculpture links ${leftLabel.toLowerCase()} and ${rightLabel.toLowerCase()} through collective form and public relation.`,
    };
  }

  if (sharedCategories.length > 0) {
    return {
      label: normalizeConceptLabel(sharedCategories[0]),
      explanation: `Shared conceptual ground in ${normalizeConceptLabel(sharedCategories[0])} shapes the relation between ${leftLabel} and ${rightLabel}.`,
    };
  }

  if (sharedLinks.length > 0) {
    return {
      label: `Linked via ${normalizeConceptLabel(sharedLinks[0])}`,
      explanation: `Internal reference ${normalizeConceptLabel(sharedLinks[0])} joins ${leftLabel} and ${rightLabel}.`,
    };
  }

  if (bridge) {
    return {
      label: `${leftLabel} / ${rightLabel}`,
      explanation: `${leftLabel} and ${rightLabel} remain in conceptual proximity through ${bridgeLabel}.`,
    };
  }

  if (theoryBoost > 0.5 || proximityScore > 0.8) {
    return {
      label: `${leftLabel} / ${rightLabel}`,
      explanation: `Theory resonance keeps ${leftLabel} and ${rightLabel} in a dense field of conceptual overlap.`,
    };
  }

  return {
    label: `${leftLabel} / ${rightLabel}`,
    explanation: `${leftLabel} and ${rightLabel} align through nearby conceptual density and contextual proximity.`,
  };
}

export function createSemanticEdges(nodes, wikiEntries = [], timestamp = now()) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const edges = [];

  for (let leftIndex = 0; leftIndex < safeNodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < safeNodes.length; rightIndex += 1) {
      const left = safeNodes[leftIndex];
      const right = safeNodes[rightIndex];
      const relation = relationScore(left, right);
      const { score, sharedKeywords, sharedCategories, sharedLinks, sharedTokens, sharedTheorySignals, sharedConcepts, theoryBoost, repetitionScore, contextualProximity, leftVector, rightVector, semanticStrength } = relation;
      const sameCategory = sharedCategories.length > 0 && String(left.semanticGroup || left.category || "").toLowerCase() === String(right.semanticGroup || right.category || "").toLowerCase();
      const theoryDriven = theoryBoost > 0.75 || sharedTheorySignals.length > 0;
      const sequentialBoost = rightIndex === leftIndex + 1 ? 0.18 : 0;
      const proximityBoost = left.phase === right.phase ? 0.1 : 0;
      const adjustedScore = score + sequentialBoost + proximityBoost;

      if (adjustedScore < (theoryDriven || sameCategory || sharedKeywords.length > 0 ? 0.92 : 1.16) && contextualProximity < 0.72) {
        continue;
      }

      const type = theoryDriven
        ? "theory"
        : sharedCategories.length > 0
          ? "category"
          : sharedLinks.length > 0
            ? "wiki"
            : sharedKeywords.length > 0 || sharedTokens.length > 0
              ? "semantic"
              : left.clusterKey === right.clusterKey
                ? "drift"
                : "semantic";
      const ttl = type === "wiki" ? 6800 : type === "drift" ? 9800 : 16000;
      const confidence = clamp((adjustedScore / 4.9) + Math.min(0.22, theoryBoost * 0.07) + Math.min(0.12, repetitionScore * 0.06), 0.18, 0.98);
      const semanticSignature = semanticHash([
        left.id || leftIndex,
        right.id || rightIndex,
        relation.label,
        sharedConcepts.join("|"),
        sharedTheorySignals.join("|"),
        String(sharedCategories[0] || ""),
        String(sharedLinks[0] || ""),
      ]);

      edges.push({
        id: `rel-${left.id || leftIndex}-${right.id || rightIndex}-${semanticSignature}-${Math.round(confidence * 100)}`,
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
        label: relation.label,
        semanticLabel: relation.label,
        semanticStrength,
        semanticSignature,
        keywords: sharedKeywords,
        sharedConcepts,
        sharedCategories,
        sharedLinks,
        sharedTokens,
        sharedTheorySignals,
        explanation: relation.explanation,
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
        id: `rel-${matches[index].id || index}-${matches[index + 1].id || index + 1}-wiki-${semanticHash([term, matches[index].id || index, matches[index + 1].id || index + 1])}`,
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
        label: normalizeConceptLabel(entry.title || term),
        semanticLabel: normalizeConceptLabel(entry.title || term),
        keywords: [term],
        sharedTokens: [term],
        sharedConcepts: [normalizeConceptLabel(entry.title || term)],
        explanation: `Live Wikipedia knowledge about ${normalizeConceptLabel(entry.title || term)} differentiates this relation from nearby conceptual links.`,
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
    const key = String(node.semanticGroup || node.category || node.role || node.conceptVector?.primaryConcept || node.concepts?.[0] || node.keyword || "allgemein");
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: `category-${tokenKey(key) || safeNodes.indexOf(node)}`,
        label: normalizeConceptLabel(GROUP_CONCEPTS.get(node.semanticGroup || node.category || node.role || "") || node.concepts?.[0] || key),
        concepts: new Map(),
        nodeIds: new Set(),
        weight: 0,
        edgeCount: 0,
        edgeWeight: 0,
        conceptWeight: 0,
        emergedAt: timestamp,
      });
    }

    const bucket = buckets.get(key);
    bucket.nodeIds.add(node.id || `node-${safeNodes.indexOf(node)}`);
    bucket.weight += Number.isFinite(node.weight) ? node.weight : 1;
    const conceptEntries = Object.entries(node.semanticWeights || {});
    if (conceptEntries.length) {
      for (const [concept, weight] of conceptEntries) {
        bucket.concepts.set(concept, (bucket.concepts.get(concept) || 0) + Number(weight || 0));
        bucket.conceptWeight += Number(weight || 0);
      }
    } else {
      for (const concept of node.concepts || []) {
        bucket.concepts.set(concept, (bucket.concepts.get(concept) || 0) + 1);
        bucket.conceptWeight += 1;
      }
    }
  }

  for (const edge of safeEdges) {
    const left = safeNodes[edge.leftIndex ?? edge.sourceIndex ?? -1];
    const right = safeNodes[edge.rightIndex ?? edge.targetIndex ?? -1];
    if (!left || !right) {
      continue;
    }

    const leftKey = String(left.semanticGroup || left.category || left.role || left.conceptVector?.primaryConcept || left.concepts?.[0] || left.keyword || "allgemein");
    const rightKey = String(right.semanticGroup || right.category || right.role || right.conceptVector?.primaryConcept || right.concepts?.[0] || right.keyword || "allgemein");
    for (const key of [leftKey, rightKey]) {
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.edgeCount += 1;
        bucket.edgeWeight += Number(edge.confidence || edge.weight || edge.score || 1);
        for (const concept of edge.sharedConcepts || []) {
          bucket.concepts.set(concept, (bucket.concepts.get(concept) || 0) + 0.62);
          bucket.conceptWeight += 0.62;
        }
      }
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const nodeCount = bucket.nodeIds.size;
      const conceptList = [...bucket.concepts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([concept]) => concept);
      const weightedDensity = nodeCount > 1 ? bucket.edgeWeight / nodeCount : bucket.edgeWeight;
      const synthesizedConcepts = conceptList.slice(0, 4);
      const synthesizedLabel = synthesizedConcepts.length >= 2 ? `${synthesizedConcepts[0]} ${synthesizedConcepts[1].replace(/^Embodied /, "")}`.trim() : synthesizedConcepts[0] || bucket.label;
      const stable = nodeCount >= 3 && weightedDensity >= 0.9;
      return {
        id: bucket.id,
        label: normalizeConceptLabel(synthesizedLabel || bucket.label),
        keywords: synthesizedConcepts.slice(0, 6),
        concepts: synthesizedConcepts.slice(0, 6),
        synopsis: synthesizedConcepts.length ? `Concept synthesis around ${synthesizedConcepts.slice(0, 3).join(" · ")}` : bucket.label,
        nodeCount,
        edgeCount: bucket.edgeCount,
        density: Number(weightedDensity.toFixed(2)),
        stable,
        weight: Number((bucket.weight / Math.max(1, nodeCount)).toFixed(2)),
        conceptWeight: Number((bucket.conceptWeight / Math.max(1, nodeCount)).toFixed(2)),
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
      const wobble = relation.type === "wiki" ? 1 : relation.type === "drift" ? 0.84 : relation.type === "theory" ? 0.98 : 0.92;
      const typeAlpha = relation.type === "wiki" ? 0.42 : relation.type === "drift" ? 0.34 : relation.type === "theory" ? 0.38 : 0.3;
      return {
        ...relation,
        age,
        progress,
        opacity: progress * typeAlpha * wobble,
      };
    })
    .filter((relation) => relation.progress > 0.14);
}
