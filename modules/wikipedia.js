const DEFAULT_ENDPOINT = "https://de.wikipedia.org/w/api.php";

function normalizeTerm(term) {
  return String(term || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWikipediaEntry(term) {
  const query = normalizeTerm(term);
  if (!query) {
    return null;
  }

  const url = `${DEFAULT_ENDPOINT}?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const [, titles, descriptions, links] = await response.json();
  const title = titles?.[0] || query;
  return {
    term: query,
    title,
    summary: descriptions?.[0] || "",
    url: links?.[0] || `https://de.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
  };
}

export async function buildWikipediaRelations(keywords) {
  const relations = [];
  const uniqueKeywords = [...new Set(keywords.filter(Boolean))].slice(0, 8);

  for (const keyword of uniqueKeywords) {
    try {
      const entry = await fetchWikipediaEntry(keyword);
      if (entry) {
        relations.push(entry);
      }
    } catch {
      continue;
    }
  }

  return relations;
}
