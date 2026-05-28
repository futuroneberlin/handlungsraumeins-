const DIMENSION_ORDER = ["participation", "temporality", "embodiment", "spatialPractice", "aestheticExperience"];
const DIMENSION_LABELS = {
  participation: "participation",
  temporality: "temporality",
  embodiment: "embodiment",
  spatialPractice: "spatial practice",
  aestheticExperience: "aesthetic experience",
};

export const THEORY_DIMENSIONS = {
  participation: {
    weight: 1.0,
    triggers: ["collective", "social", "interaction", "participation", "public", "community", "dialogue", "relation"],
  },
  temporality: {
    weight: 0.92,
    triggers: ["time", "duration", "process", "movement", "drift", "transformation", "change"],
  },
  embodiment: {
    weight: 0.88,
    triggers: ["body", "gesture", "presence", "action", "practice", "physical"],
  },
  spatialPractice: {
    weight: 0.95,
    triggers: ["space", "architecture", "structure", "foundation", "construction", "volume", "density"],
  },
  aestheticExperience: {
    weight: 0.9,
    triggers: ["experience", "perception", "aesthetic", "sensation", "encounter"],
  },
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenSignals(fragment) {
  if (!fragment) {
    return [];
  }

  const raw = Array.isArray(fragment)
    ? fragment
    : [
      fragment.title,
      fragment.text,
      fragment.summary,
      fragment.excerpt,
      fragment.wikiSummary,
      fragment.semanticLabel,
      ...(fragment.concepts || []),
      ...(fragment.keywords || []),
      ...(fragment.categories || []),
      ...(fragment.wikiCategories || []),
    ];

  return [...new Set(raw.map(normalize).filter(Boolean).flatMap((value) => value.split(/[|,;]+/).map(normalize).filter(Boolean)))];
}

function scoreDimension(signals, dimension) {
  const hits = signals.filter((signal) => dimension.triggers.some((trigger) => signal.includes(trigger)));
  if (!hits.length) {
    return { score: 0, hits: [] };
  }

  const overlap = hits.reduce((total, signal) => total + Math.min(1, dimension.triggers.filter((trigger) => signal.includes(trigger)).length * 0.22), 0);
  const score = dimension.weight + overlap + Math.min(0.34, (hits.length - 1) * 0.08);
  return { score, hits };
}

export function evaluateTheoryResonance(fragment = {}) {
  const signals = flattenSignals(fragment);
  const activated = [];
  let totalScore = 0;

  for (const dimensionKey of DIMENSION_ORDER) {
    const dimension = THEORY_DIMENSIONS[dimensionKey];
    const result = scoreDimension(signals, dimension);
    if (!result.hits.length) {
      continue;
    }

    totalScore += result.score;
    activated.push({
      id: dimensionKey,
      label: DIMENSION_LABELS[dimensionKey] || dimensionKey,
      score: Number(result.score.toFixed(3)),
      evidence: result.hits.slice(0, 3),
    });
  }

  const hasNoiseOnly = !activated.length || signals.length === 0;
  const score = Number(Math.max(0, Math.min(4, totalScore)).toFixed(3));
  const activatedDimensions = activated.sort((left, right) => right.score - left.score).map((entry) => entry.label);
  const dominantDimension = activated[0]?.label || null;

  return {
    score,
    activatedDimensions,
    dominantDimension,
    reject: hasNoiseOnly || score < 1.1,
  };
}

export function evaluateNodeTheoryResonance(node, options = {}) {
  return evaluateTheoryResonance(node, options);
}
