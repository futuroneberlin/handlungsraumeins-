import { groupKeywordsBySemantic, semanticGroupOrder, assignKeywordToGroup } from "../core/semantics.js";
import { extractKeywords, normalizeText } from "./textFragmenter.js";

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
    const text = normalizeText(entry.text || "");
    const keywords = extractKeywords(text, 8);
    for (const kw of keywords) candidate.push(kw);
  }

  const freq = new Map();
  for (const k of candidate) freq.set(k, (freq.get(k) || 0) + 1);

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
    return {
      id: `term-${item.keyword}-${idx}`,
      text: item.keyword,
      keywords: [item.keyword],
      keyword: item.keyword,
      weight: Math.min(1, 0.6 + (item.freq || 1) * 0.07),
      rarity: Math.max(0.3, 1 - (item.freq || 1) * 0.08),
      repetition: Math.max(0, (item.freq || 1) - 1),
      semanticGroup: item.group,
      role,
      source: "theory",
      fragmentOrder: idx,
      preferredLane: idx % 3,
      preferredDepthLayer: role === "central" ? 0 : role === "secondary" ? 1 : 2,
      phase: "extraction",
      opacity: role === "central" ? 0.96 : role === "secondary" ? 0.88 : 0.72,
    };
  });

  console.log(
    "semanticExtractor",
    extracted.length,
    extracted.map((item) => ({ text: item.text, group: item.semanticGroup, role: item.role, weight: item.weight })),
  );

  return extracted;
}
