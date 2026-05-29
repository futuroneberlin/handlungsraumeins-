export const THEORY_CORE_TITLE = "Actional Space of Aesthetic Practice";

export const THEORY_CORE_TEXT = "The Actional Space of Aesthetic Practice is an internal conceptual framework for sculptural knowledge, where action, participation, temporality, and spatial transformation shape meaning.";

export const THEORY_FOUNDATIONAL_MODEL = [
  "The Actional Space of Aesthetic Practice is an expanded sculptural environment in which the artwork loses its fixed object identity and dissolves into a living process.",
  "This space is constituted through action, interaction, temporality, participation, spatial transformation, and relational experience.",
  "The artwork is no longer a static object, but an experiential field generated through participation itself.",
  "Meaning does not emerge from isolated representation, but from lived relational activation.",
].join(" ");

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

export const THEORY_CORE_CONSTELLATION = [
  "Participation",
  "Temporality",
  "Transformation",
  "Spatial Interaction",
  "Collapse of Subject Object Distance",
  "Collective Action",
  "Spatial Practice",
  "Embodied Interaction",
  "Experience",
  "Relation",
  "Process",
  "Material",
  "Gesture",
  "Construction",
  "Movement",
  "Spatial Tension",
  "Social Sculpture",
];

export const THEORY_VALIDATION_DIMENSIONS = [
  { id: "participation", label: "Participation as Structure", terms: ["participation", "participatory", "collective participation", "co-creation"], weight: 1.35 },
  { id: "interaction", label: "Interaction as Meaning Production", terms: ["interaction", "interactivity", "exchange", "dialogic"], weight: 1.28 },
  { id: "temporality", label: "Temporality as Artistic Condition", terms: ["temporality", "time", "duration", "unfolding", "sequence"], weight: 1.32 },
  { id: "transformation", label: "Relational Transformation", terms: ["transformation", "becoming", "conversion", "shift", "metamorph"], weight: 1.34 },
  { id: "spatial-practice", label: "Spatial Activation", terms: ["spatial", "space", "site", "field", "activation"], weight: 1.16 },
  { id: "embodied-action", label: "Embodied Action", terms: ["embodied", "body", "gesture", "movement", "action"], weight: 1.22 },
  { id: "process", label: "Process over Object", terms: ["process", "processual", "ongoing", "dynamic", "formation"], weight: 1.2 },
  { id: "relation", label: "Relational Experience", terms: ["relation", "relational", "collective", "community", "shared experience"], weight: 1.24 },
  { id: "collective-experience", label: "Collective Experience", terms: ["collective experience", "shared", "participants", "co-presence"], weight: 1.18 },
  { id: "volume-to-body", label: "From Volume to Body / Action", terms: ["volume to body", "body / action", "embodied movement", "gesture"], weight: 1.1 },
  { id: "object-to-time", label: "From Static Object to Time / Interaction", terms: ["static object", "time / interaction", "temporal process", "unfolding interaction"], weight: 1.12 },
  { id: "authorship-to-collective", label: "From Isolated Authorship to Collective Production", terms: ["collective production", "co-authored", "co-created", "shared authorship"], weight: 1.08 },
  { id: "object-to-relational-field", label: "From Material Object to Relational Field", terms: ["relational field", "field condition", "relation as material"], weight: 1.08 },
];

const LOW_RESONANCE_PATTERNS = [
  "is the study of",
  "is a",
  "refers to",
  "born",
  "died",
  "located in",
  "category:",
  "citation",
  "template",
  "infobox",
  "metadata",
];

const TRANSFORMATION_PAIRS = [
  { from: ["volume", "mass", "object"], to: ["body", "action", "embodied"] },
  { from: ["static", "artifact", "fixed"], to: ["time", "interaction", "process"] },
  { from: ["author", "individual", "isolated"], to: ["collective", "participants", "shared"] },
  { from: ["material", "thing"], to: ["relational", "field", "experience"] },
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
  ["material", 1.2],
  ["gesture", 1.18],
  ["construction", 1.22],
  ["spatial tension", 1.32],
  ["experience", 1.2],
  ["relation", 1.25],
  ["spatial practice", 1.4],
  ["spatial interaction", 1.52],
  ["subject object", 1.45],
  ["observer", 1.18],
  ["author", 1.12],
  ["embodied interaction", 1.55],
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNormalized(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flat()
    .map(normalize)
    .filter(Boolean))];
}

function includesAnyTerm(signal, terms = []) {
  const normalizedSignal = normalize(signal);
  return terms.some((term) => {
    const normalizedTerm = normalize(term);
    return normalizedSignal.includes(normalizedTerm) || normalizedTerm.includes(normalizedSignal);
  });
}

function collectOntologySignals(values = []) {
  return uniqueNormalized(values)
    .flatMap((value) => value.split(/[|,;]+/).map((part) => normalize(part)).filter(Boolean));
}

function transformationEvidence(signals = []) {
  let score = 0;
  const evidence = [];

  for (const pair of TRANSFORMATION_PAIRS) {
    const fromMatch = signals.some((signal) => includesAnyTerm(signal, pair.from));
    const toMatch = signals.some((signal) => includesAnyTerm(signal, pair.to));
    if (fromMatch && toMatch) {
      score += 0.42;
      evidence.push(`${pair.from[0]} -> ${pair.to[0]}`);
    }
  }

  return { score, evidence };
}

export function evaluateTheoryResonance(values = [], options = {}) {
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 1.8;
  const signals = collectOntologySignals(values);
  const dimensions = [];
  let score = 0;

  for (const dimension of THEORY_VALIDATION_DIMENSIONS) {
    const hits = signals.filter((signal) => includesAnyTerm(signal, dimension.terms));
    if (!hits.length) {
      continue;
    }

    const dimensionScore = dimension.weight + Math.min(0.5, (hits.length - 1) * 0.12);
    score += dimensionScore;
    dimensions.push({
      id: dimension.id,
      label: dimension.label,
      score: Number(dimensionScore.toFixed(3)),
      evidence: [...new Set(hits)].slice(0, 3),
    });
  }

  const transformation = transformationEvidence(signals);
  score += transformation.score;

  const lowSignals = signals.filter((signal) => LOW_RESONANCE_PATTERNS.some((pattern) => signal.includes(pattern)));
  const noisePenalty = Math.min(1.25, lowSignals.length * 0.24);
  score -= noisePenalty;

  const dimensionBonus = dimensions.length >= 3 ? 0.35 : dimensions.length >= 2 ? 0.18 : 0;
  score += dimensionBonus;

  const normalizedScore = Number(Math.max(0, Math.min(4, score)).toFixed(3));
  const activatedDimensions = dimensions
    .sort((left, right) => right.score - left.score)
    .map((dimension) => dimension.label);

  return {
    score: normalizedScore,
    highResonance: normalizedScore >= minScore,
    reject: normalizedScore < minScore,
    dimensions,
    activatedDimensions,
    transformationEvidence: transformation.evidence,
    lowResonanceReasons: lowSignals.slice(0, 3),
  };
}

export function evaluateNodeTheoryResonance(node, options = {}) {
  if (!node) {
    return evaluateTheoryResonance([], options);
  }

  return evaluateTheoryResonance([
    ...(node.concepts || []),
    ...(node.keywords || []),
    ...(node.wikiCategories || []),
    ...(node.wikiLinks || []),
    node.semanticLabel,
    node.semanticExcerpt,
    node.title,
    node.text,
    node.wikiSummary,
    node.abstract,
    node.category,
    node.semanticGroup,
  ], options);
}

export function translateSemanticPhysics(resonanceScore = 0, activatedDimensions = []) {
  const score = clamp01(Number(resonanceScore || 0) / 4);
  const dimensionCount = Array.isArray(activatedDimensions) ? activatedDimensions.length : 0;
  const densityBoost = Math.min(0.18, dimensionCount * 0.024);
  const stability = clamp01(score * 0.72 + densityBoost);

  return {
    semanticMass: Number((0.82 + stability * 3.9).toFixed(3)),
    forcePull: Number((0.018 + stability * 0.07).toFixed(4)),
    damping: Number((0.992 - stability * 0.03).toFixed(4)),
    collisionRadius: Number((74 + stability * 92).toFixed(2)),
    orbitRadius: Number((238 - stability * 128).toFixed(2)),
    orbitSpeed: Number((0.0019 - stability * 0.00135).toFixed(5)),
    persistence: Number((0.24 + stability * 0.72).toFixed(3)),
    opacity: Number((0.26 + stability * 0.68).toFixed(3)),
    depth: Number((1.72 - stability * 1.12).toFixed(3)),
    depthLift: Number((10 + stability * 14).toFixed(2)),
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function curateSemanticSignals(signals = [], options = {}) {
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 1.15;
  const normalizedSignals = uniqueNormalized(signals);
  const curated = [];

  for (const signal of normalizedSignals) {
    let score = 0;
    const matchedAnchors = [];

    for (const anchor of THEORY_CORE_CONSTELLATION) {
      const normalizedAnchor = normalize(anchor);
      if (signal.includes(normalizedAnchor) || normalizedAnchor.includes(signal)) {
        matchedAnchors.push(anchor);
        score += 0.85;
      }
    }

    for (const [term, weight] of THEORY_WEIGHT_MAP.entries()) {
      if (signal.includes(term) || term.includes(signal)) {
        score += weight * 0.34;
      }
    }

    if (signal.length < 4 || /^(category|article|page|edit|citation|reference|template)$/i.test(signal)) {
      score -= 1.4;
    }

    if (score >= minScore) {
      curated.push({
        signal,
        score: Number(score.toFixed(3)),
        anchors: matchedAnchors,
      });
    }
  }

  return curated.sort((left, right) => right.score - left.score || left.signal.localeCompare(right.signal));
}

export function synthesizeConceptualStatement(concepts = [], fallback = THEORY_CORE_TITLE) {
  const curated = curateSemanticSignals(concepts, { minScore: 0.9 }).map((item) => item.signal);
  const has = (term) => curated.some((signal) => signal.includes(term));

  if (has("participation") && (has("embodied") || has("body")) && (has("collective") || has("social"))) {
    return "Embodied participation transforms spatial experience into collective sculptural action.";
  }

  if ((has("temporality") || has("time") || has("process")) && (has("transformation") || has("movement"))) {
    return "Temporal process reshapes movement into a sustained sculptural transformation field.";
  }

  if ((has("space") || has("spatial")) && (has("practice") || has("construction") || has("material"))) {
    return "Spatial practice condenses material relations into a readable architectural tension.";
  }

  if (has("social sculpture") || (has("collective") && has("relation"))) {
    return "Social sculpture stabilizes relation as a shared material of collective formation.";
  }

  if (curated.length >= 2) {
    return `${curated[0].replace(/^./, (char) => char.toUpperCase())} and ${curated[1]} condense into a processual sculptural relation.`;
  }

  return fallback;
}

function collectNodeSignals(node) {
  return [
    ...(Array.isArray(node?.concepts) ? node.concepts : []),
    node?.semanticLabel,
    node?.text,
    node?.title,
    node?.semanticExcerpt,
    node?.wikiSummary,
    node?.abstract,
    ...(Array.isArray(node?.theoryDimensions) ? node.theoryDimensions : []),
    ...(Array.isArray(node?.activatedDimensions) ? node.activatedDimensions : []),
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
  const theorySignals = [...new Set([
    ...leftTheorySignals,
    ...rightTheorySignals,
    ...sharedConcepts,
  ].map(normalize).filter(Boolean))];

  if (theoryBoost > 0.8) {
    if (theorySignals.some((signal) => signal.includes("participation") || signal.includes("interaction"))) {
      return `Participation and interaction bind ${leftLabel} with ${rightLabel} through the theory core.`;
    }

    if (theorySignals.some((signal) => signal.includes("transformation") || signal.includes("social sculpture"))) {
      return `The theory core frames ${leftLabel} and ${rightLabel} as a sculptural transformation field.`;
    }

    if (theorySignals.some((signal) => signal.includes("collective action") || signal.includes("community"))) {
      return `Collective action links ${leftLabel} and ${rightLabel} within the theory core.`;
    }

    return `Theory resonance keeps ${leftLabel} and ${rightLabel} in a shared field of action and transformation.`;
  }

  if (theorySignals.some((signal) => signal.includes("participation") || signal.includes("interaction") || signal.includes("participatory"))) {
    return `Participation and interaction connect ${leftLabel} with ${rightLabel}.`;
  }

  if (theorySignals.some((signal) => signal.includes("transformation") || signal.includes("body") || signal.includes("sculpture") || signal.includes("practice") || signal.includes("process"))) {
    return `Sculptural transformation links ${leftLabel} with ${rightLabel}.`;
  }

  if (theorySignals.some((signal) => signal.includes("space") || signal.includes("public") || signal.includes("society") || signal.includes("community") || signal.includes("collective action"))) {
    return `Public space and collective relation connect ${leftLabel} with ${rightLabel}.`;
  }

  if (repetitionScore > 0.2) {
    return `Repeated contextual appearance keeps ${leftLabel} and ${rightLabel} in proximity.`;
  }

  return `Semantic overlap keeps ${leftLabel} and ${rightLabel} in relation.`;
}
