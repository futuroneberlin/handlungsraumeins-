const SEMANTIC_GROUPS = {
  Raum: ["raum", "struktur", "fundament", "architektur", "raumlich", "raumlichkeit"],
  Handlung: ["praxis", "handlung", "prozess", "bewegung", "aktivität"],
  Gesellschaft: ["sozial", "relation", "öffentlichkeit", "gesellschaft", "öffentlich"],
  Kunst: ["erfahrung", "soziale", "plastik", "bildhauerei", "kunst"],
  Konstruktion: ["aufbau", "verdichtung", "schichtung", "konstruktion", "strukturierung"],
};

function normalize(word) {
  return String(word || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function assignKeywordToGroup(keyword) {
  const k = normalize(keyword);
  for (const [group, words] of Object.entries(SEMANTIC_GROUPS)) {
    for (const w of words) {
      if (k === w || k.indexOf(w) === 0 || w.indexOf(k) === 0 || k.includes(w)) {
        return group;
      }
    }
  }
  return null;
}

export function groupKeywordsBySemantic(keywordsWithFreq = []) {
  const groups = new Map();
  for (const [keyword, freq] of keywordsWithFreq) {
    const group = assignKeywordToGroup(keyword) || "Andere";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ keyword, freq });
  }

  // sort each group's keywords by frequency desc
  for (const [k, arr] of groups) {
    arr.sort((a, b) => b.freq - a.freq || a.keyword.localeCompare(b.keyword));
  }

  return groups;
}

export function semanticGroupOrder() {
  return Object.keys(SEMANTIC_GROUPS);
}
