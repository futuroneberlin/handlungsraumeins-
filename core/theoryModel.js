export const THEORY_CORE_TITLE = "Actional Space of Aesthetic Practice";

export const THEORY_CORE_TEXT = "The Actional Space of Aesthetic Practice is an internal conceptual framework for sculptural knowledge, where action, participation, temporality, and spatial transformation shape meaning.";

export const THEORY_CORE_KEYWORDS = [
  "participation",
  "transformation",
  "body",
  "temporality",
  "social sculpture",
  "collective action",
  "space",
  "action",
  "interaction",
  "process",
  "practice",
  "public space",
];

export const THEORY_STABILIZATION_PATTERNS = [
  {
    terms: ["participation", "interaction", "body"],
    statement: "Action as sculptural participation",
  },
  {
    terms: ["temporality", "process", "movement"],
    statement: "Temporal transformation of sculptural space",
  },
  {
    terms: ["social sculpture", "collective action", "community"],
    statement: "Collective action as social sculpture",
  },
  {
    terms: ["space", "practice", "relation"],
    statement: "Spatial practice as relational formation",
  },
  {
    terms: ["transformation", "process", "space"],
    statement: "Processual transformation of spatial form",
  },
];

const THEORY_WEIGHT_MAP = new Map([
  ["participation", 1.8],
  ["transformation", 1.7],
  ["body", 1.35],
  ["temporality", 1.45],
  ["social sculpture", 1.9],
  ["collective action", 1.7],
  ["space", 1.2],
  ["action", 1.7],
  ["interaction", 1.55],
  ["process", 1.1],
  ["practice", 1.22],
  ["public space", 1.5],
  ["public", 1.2],
  ["relation", 1.05],
  ["movement", 1.15],
  ["community", 1.05],
  ["collective", 1.08],
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectNodeSignals(node) {
  return [
    ...(Array.isArray(node?.keywords) ? node.keywords : []),
    ...(Array.isArray(node?.wikiCategories) ? node.wikiCategories : []),
    ...(Array.isArray(node?.wikiLinks) ? node.wikiLinks : []),
    node?.text,
    node?.keyword,
    node?.title,
    node?.category,
    node?.semanticGroup,
    node?.role,
    node?.wikiSummary,
  ]
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);
}

export function theoryResonanceTerms(node) {
  const signals = collectNodeSignals(node);
  const matches = [];

  for (const [term] of THEORY_WEIGHT_MAP.entries()) {
    if (signals.some((signal) => signal.includes(term) || term.includes(signal))) {
      matches.push(term);
    }
  }

  return [...new Set(matches)];
}

export function theoryAffinity(node) {
  let score = 0;
  const signals = collectNodeSignals(node);
  const resonanceTerms = theoryResonanceTerms(node);

  for (const signal of signals) {
    for (const [term, weight] of THEORY_WEIGHT_MAP.entries()) {
      if (signal.includes(term) || term.includes(signal)) {
        score += weight;
      }
    }
  }

  if (signals.some((signal) => signal.includes("participation") || signal.includes("interaction"))) {
    score += 0.7;
  }

  if (signals.some((signal) => signal.includes("transformation") || signal.includes("sculptur"))) {
    score += 0.7;
  }

  if (signals.some((signal) => signal.includes("space") || signal.includes("public"))) {
    score += 0.5;
  }

  if (signals.some((signal) => signal.includes("collective") || signal.includes("community"))) {
    score += 0.45;
  }

  if (signals.some((signal) => signal.includes("practice") || signal.includes("process"))) {
    score += 0.35;
  }

  score += resonanceTerms.length * 0.2;

  if (String(node?.id || "").includes("theory-core")) {
    score += 4;
  }

  return score;
}

export function stabilizeTheoryStatement(signals = [], fallback = "Actional Space of Aesthetic Practice") {
  const normalizedSignals = [...new Set((Array.isArray(signals) ? signals : [signals])
    .flat()
    .map(normalize)
    .filter(Boolean))];

  for (const pattern of THEORY_STABILIZATION_PATTERNS) {
    const hasAllTerms = pattern.terms.every((term) => normalizedSignals.some((signal) => signal.includes(term) || term.includes(signal)));
    if (hasAllTerms) {
      return pattern.statement;
    }
  }

  if (normalizedSignals.some((signal) => signal.includes("participation") || signal.includes("interaction"))) {
    return "Action as participatory form";
  }

  if (normalizedSignals.some((signal) => signal.includes("temporality") || signal.includes("process"))) {
    return "Temporal change as sculptural process";
  }

  if (normalizedSignals.some((signal) => signal.includes("collective") || signal.includes("social"))) {
    return "Collective relation as sculptural knowledge";
  }

  if (normalizedSignals.some((signal) => signal.includes("space") || signal.includes("form"))) {
    return "Spatial form as conceptual stabilization";
  }

  return fallback;
}

export function theoryResonanceProfile(node) {
  const signals = collectNodeSignals(node);
  const resonanceTerms = theoryResonanceTerms(node);
  return {
    signals,
    resonanceTerms,
    affinity: theoryAffinity(node),
    statement: stabilizeTheoryStatement(signals.concat(resonanceTerms), THEORY_CORE_TITLE),
  };
}

function hasAnySignal(signals, terms) {
  return signals.some((signal) => terms.some((term) => signal.includes(term)));
}

export function explainTheoryConnection({ sharedKeywords = [], sharedCategories = [], sharedLinks = [], sharedConcepts = [], theoryBoost = 0, repetitionScore = 0, left, right, leftTheorySignals = [], rightTheorySignals = [] }) {
  const leftLabel = String(left?.semanticLabel || left?.title || left?.keyword || left?.text || "Concept");
  const rightLabel = String(right?.semanticLabel || right?.title || right?.keyword || right?.text || "Concept");
  const signals = normalize([
    ...sharedKeywords,
    ...sharedCategories,
    ...sharedLinks,
    ...sharedConcepts,
    left?.keyword,
    left?.text,
    left?.category,
    left?.semanticGroup,
    right?.keyword,
    right?.text,
    right?.category,
    right?.semanticGroup,
  ]).split(" ");
  const theorySignals = [...new Set([
    ...leftTheorySignals,
    ...rightTheorySignals,
  ])];

  if (theoryBoost > 0.8) {
    if (theorySignals.includes("participation") || theorySignals.includes("interaction")) {
      return `Participation and interaction bind ${leftLabel} with ${rightLabel} through the theory core.`;
    }

    if (theorySignals.includes("transformation") || theorySignals.includes("social sculpture")) {
      return `The theory core frames ${leftLabel} and ${rightLabel} as a sculptural transformation field.`;
    }

    if (theorySignals.includes("collective action") || theorySignals.includes("community")) {
      return `Collective action links ${leftLabel} and ${rightLabel} within the theory core.`;
    }

    return `Theory resonance keeps ${leftLabel} and ${rightLabel} in a shared field of action and transformation.`;
  }

  if (hasAnySignal(signals, ["participation", "interaction", "participatory"])) {
    return `Participation and interaction connect ${leftLabel} with ${rightLabel}.`;
  }

  if (hasAnySignal(signals, ["transformation", "body", "sculpture", "practice", "process"])) {
    return `Sculptural transformation links ${leftLabel} with ${rightLabel}.`;
  }

  if (hasAnySignal(signals, ["space", "public", "society", "community", "collective action"])) {
    return `Public space and collective relation connect ${leftLabel} with ${rightLabel}.`;
  }

  if (sharedCategories.length > 0) {
    return `Linked through shared Wikipedia category ${sharedCategories[0]}`;
  }

  if (sharedLinks.length > 0) {
    return `Linked by the internal Wikipedia reference ${sharedLinks[0]}`;
  }

  if (sharedKeywords.length > 0) {
    return `Connected through ${sharedKeywords.slice(0, 2).join(" and ")} between ${leftLabel} and ${rightLabel}.`;
  }

  if (repetitionScore > 0.2) {
    return `Repeated contextual appearance keeps ${leftLabel} and ${rightLabel} in proximity.`;
  }

  return `Semantic overlap keeps ${leftLabel} and ${rightLabel} in relation.`;
}
