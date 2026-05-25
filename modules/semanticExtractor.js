import { groupKeywordsBySemantic, semanticGroupOrder, assignKeywordToGroup } from "../core/semantics.js";
import { createConceptExcerpt, createFragments, extractKeywords, normalizeText } from "./textFragmenter.js";

const RELEVANT_TERMS = new Set([
  "raum",
  "handlung",
  "plastik",
  "gesellschaft",
  "verdichtung",
  "bewegung",
  "relation",
  "architektur",
  "praxis",
  "form",
  "energie",
  "struktur",
  "fundament",
  "schichtung",
  "erfahrung",
  "kunst",
  "prozess",
  "leere",
  "drift",
  "körper",
  "mauerwerk",
  "typografie",
  "sozial",
  "soziale",
  "beuys",
  "dewey",
  "bertram",
]);

const CONCEPT_MAP = [
  { terms: ["beuys", "soziale", "sozial", "gesellschaft"], label: "Collective Participation", group: "Gesellschaft" },
  { terms: ["praxis", "handlung", "aktivität"], label: "Embodied Action", group: "Handlung" },
  { terms: ["prozess", "bewegung", "zeit"], label: "Temporal Interaction", group: "Handlung" },
  { terms: ["raum", "architektur", "struktur", "fundament"], label: "Spatial Transformation", group: "Raum" },
  { terms: ["plastik", "kunst", "erfahrung"], label: "Expanded Art Practice", group: "Kunst" },
  { terms: ["verdichtung", "schichtung", "konstruktion"], label: "Processual Sculpture", group: "Konstruktion" },
  { terms: ["körper"], label: "Embodied Practice", group: "Handlung" },
  { terms: ["relation", "öffentlichkeit"], label: "Relational Space", group: "Gesellschaft" },
];

function conceptLabelFor(keyword, group) {
  const normalized = normalizeText(keyword).toLowerCase();
  for (const concept of CONCEPT_MAP) {
    if (concept.terms.some((term) => normalized.includes(term) || term.includes(normalized))) {
      return { label: concept.label, group: concept.group || group };
    }
  }

  const fallbackByGroup = {
    Raum: "Spatial Configuration",
    Handlung: "Processual Action",
    Gesellschaft: "Collective Relation",
    Kunst: "Aesthetic Practice",
    Konstruktion: "Structural Formation",
  };

  return { label: fallbackByGroup[group] || keyword, group };
}

function classifyRole(group, rank, total) {
  const centralGroups = ["Raum", "Handlung", "Gesellschaft", "Kunst", "Konstruktion"];
  if (centralGroups.includes(group)) return "central";
  if (rank <= Math.max(2, Math.floor(total * 0.12))) return "central";
  if (rank <= Math.max(4, Math.floor(total * 0.28))) return "secondary";
  return "peripheral";
}

export function extractFoundationTerms(corpus, maxTerms = 18) {
  const candidate = [];
  for (const entry of corpus) {
    const fragments = createFragments(entry.text || "", {
      source: entry.source || "theory",
      maxFragments: 5,
    });

    for (const fragment of fragments) {
      const keywords = extractKeywords(fragment.text || "", 5);
      for (const kw of keywords) {
        const normalized = normalizeText(kw).toLowerCase();
        if (normalized.length < 3) continue;
        if (RELEVANT_TERMS.has(normalized) || assignKeywordToGroup(normalized)) {
          candidate.push(normalized);
        }
      }
    }
  }

  const freq = new Map();
  for (const k of candidate) freq.set(k, (freq.get(k) || 0) + 1);

  if (!freq.size) {
    for (const term of RELEVANT_TERMS) {
      freq.set(term, 1);
    }
  }

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const grouped = groupKeywordsBySemantic(sorted);
  const order = semanticGroupOrder().concat(["Andere"]);
  const chosen = [];
  for (const g of order) {
    const list = grouped.get(g) || [];
    for (let i = 0; i < Math.min(3, list.length); i++) {
      chosen.push({ keyword: list[i].keyword, freq: list[i].freq, group: g });
      if (chosen.length >= maxTerms) break;
    }
    if (chosen.length >= maxTerms) break;
  }

  const total = chosen.length;
  const extracted = chosen.slice(0, maxTerms).map((item, idx) => {
    const role = classifyRole(item.group, idx + 1, total);
    const excerpt = createConceptExcerpt(item.keyword, 8);
    const concept = conceptLabelFor(item.keyword, item.group);
    const semanticWeights = {
      [concept.label]: 1,
      [item.keyword]: 0.84,
      [concept.group]: 0.72,
    };
    return {
      id: `term-${item.keyword}`,
      text: concept.label,
      title: concept.label,
      excerpt,
      keywords: [concept.label, item.keyword],
      concepts: [concept.label, item.keyword, concept.group],
      keyword: concept.label,
      sourceKeyword: item.keyword,
      weight: Math.min(1, 0.6 + (item.freq || 1) * 0.07),
      rarity: Math.max(0.3, 1 - (item.freq || 1) * 0.08),
      repetition: Math.max(0, (item.freq || 1) - 1),
      semanticGroup: concept.group,
      semanticWeights,
      theoryResonanceScore: role === "central" ? 0.92 : role === "secondary" ? 0.74 : 0.58,
      semanticDensity: Math.min(1, 0.32 + item.freq * 0.06),
      semanticSignature: `term-${item.keyword}-${concept.group}`,
      semanticLabel: concept.label,
      relationCandidates: [],
      role,
      source: "theory",
      fragmentOrder: idx,
      preferredLane: idx % 3,
      preferredDepthLayer: role === "central" ? 0 : role === "secondary" ? 1 : 2,
      phase: "extraction",
      opacity: role === "central" ? 0.96 : role === "secondary" ? 0.88 : 0.72,
      resonance: role === "central" ? 0.95 : role === "secondary" ? 0.78 : 0.62,
    };
  });

  return extracted;
}
