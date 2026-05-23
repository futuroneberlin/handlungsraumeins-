const DEFAULT_ENDPOINT = "https://en.wikipedia.org/w/api.php";

function normalizeTerm(term) {
  return String(term || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function resolveWikipediaTitle(term) {
  const searchUrl = `${DEFAULT_ENDPOINT}?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=1&format=json&origin=*`;
  const data = await fetchJson(searchUrl);
  const title = data?.query?.search?.[0]?.title;
  return title || term;
}

function extractListTitles(items = [], prefix = "") {
  return items
    .map((item) => String(item?.title || ""))
    .map((title) => title.replace(new RegExp(`^${prefix}`, "i"), ""))
    .map((title) => title.trim())
    .filter(Boolean);
}

export async function fetchWikipediaEntry(term) {
  const query = normalizeTerm(term);
  if (!query) {
    return null;
  }

  const title = await resolveWikipediaTitle(query);
  const detailUrl = `${DEFAULT_ENDPOINT}?action=query&titles=${encodeURIComponent(title)}&prop=extracts|categories|links|info&inprop=url&exintro=1&explaintext=1&cllimit=max&plnamespace=0&pllimit=max&redirects=1&format=json&origin=*`;
  const data = await fetchJson(detailUrl);
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const page = pages[0];
  if (!page) {
    return null;
  }

  const categories = extractListTitles(page.categories, "Category:").slice(0, 12);
  const internalLinks = extractListTitles(page.links).slice(0, 24);

  return {
    term: query,
    title: page.title || title,
    summary: String(page.extract || "").trim(),
    categories,
    links: internalLinks,
    pageid: page.pageid,
    url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title || title).replace(/\s+/g, "_"))}`,
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
