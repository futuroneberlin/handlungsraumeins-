export const THEORY_CORE_TITLE = "Actional Space of Aesthetic Practice";

export const THEORY_CORE_TEXT = "The Actional Space of Aesthetic Practice is an internal conceptual framework for sculptural knowledge, where action, participation, temporality, and spatial transformation shape meaning.";

export const THEORY_CORE_KEYWORDS = [
  "participation",
  "transformation",
  "body",
  "temporality",
  "social sculpture",
  "space",
  "action",
  "interaction",
  "process",
  "public space",
];

const THEORY_WEIGHT_MAP = new Map([
  ["participation", 1.8],
  ["transformation", 1.7],
  ["body", 1.35],
  ["temporality", 1.45],
  ["social sculpture", 1.9],
  ["space", 1.2],
  ["action", 1.7],
  ["interaction", 1.55],
  ["process", 1.1],
  ["public space", 1.5],
  ["public", 1.2],
  ["relation", 1.05],
  ["movement", 1.15],
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

export function theoryAffinity(node) {
  let score = 0;
  const signals = collectNodeSignals(node);

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

  if (String(node?.id || "").includes("theory-core")) {
    score += 4;
  }

  return score;
}

function hasAnySignal(signals, terms) {
  return signals.some((signal) => terms.some((term) => signal.includes(term)));
}

export function explainTheoryConnection({ sharedKeywords = [], sharedCategories = [], sharedLinks = [], theoryBoost = 0, repetitionScore = 0, left, right }) {
  const signals = normalize([
    ...sharedKeywords,
    ...sharedCategories,
    ...sharedLinks,
    left?.keyword,
    left?.text,
    left?.category,
    left?.semanticGroup,
    right?.keyword,
    right?.text,
    right?.category,
    right?.semanticGroup,
  ]).split(" ");

  if (theoryBoost > 0.8) {
    return "Connected through the theory core's field of action, participation, and transformation";
  }

  if (hasAnySignal(signals, ["participation", "interaction", "participatory"])) {
    return "Connected through participation";
  }

  if (hasAnySignal(signals, ["transformation", "body", "sculpture", "practice"])) {
    return "Linked by sculptural transformation";
  }

  if (hasAnySignal(signals, ["space", "public", "society", "community"])) {
    return "Related through public space";
  }

  if (sharedCategories.length > 0) {
    return `Linked through shared Wikipedia category ${sharedCategories[0]}`;
  }

  if (sharedLinks.length > 0) {
    return `Linked by the internal Wikipedia reference ${sharedLinks[0]}`;
  }

  if (sharedKeywords.length > 0) {
    return `Connected through ${sharedKeywords.slice(0, 2).join(" and ")}`;
  }

  if (repetitionScore > 0.2) {
    return "Related through repeated contextual appearance";
  }

  return "Related through semantic overlap";
}
