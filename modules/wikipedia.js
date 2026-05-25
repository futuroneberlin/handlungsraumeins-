const DEFAULT_ENDPOINT = "https://en.wikipedia.org/w/api.php";

const NOISE_PATTERNS = [
  /^articles with /i,
  /^all articles /i,
  /^use dmy dates/i,
  /^pages? using /i,
  /^wikipedia /i,
  /^cs1 /i,
  /^short description/i,
  /^webarchive/i,
  /^pages? with /i,
  /^maintenance /i,
  /^disambiguation /i,
  /^living people$/i,
  /^use /i,
  /^stub$/i,
];

const GENERIC_NOISE = new Set([
  "article",
  "articles",
  "page",
  "pages",
  "wikipedia",
  "citation",
  "references",
  "source",
  "sources",
  "category",
  "categories",
  "pageid",
  "info",
]);

function isConceptualText(value) {
  const text = normalizeTerm(value).toLowerCase();
  if (!text) {
    return false;
  }

  if (text.length < 3) {
    return false;
  }

  if (NOISE_PATTERNS.some((pattern) => pattern.test(text))) {
    return false;
  }

  if (GENERIC_NOISE.has(text)) {
    return false;
  }

  return !/\b(?:edit|citation|template|stub|disambiguation|maintenance|wikipedia)\b/i.test(text);
}

function toConceptKeywords(title, summary = "", categories = []) {
  const words = normalizeTerm(`${title} ${summary} ${categories.join(" ")}`)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !GENERIC_NOISE.has(word));

  const frequency = new Map();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([word]) => word)
    .filter(isConceptualText);
}

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
    .filter(isConceptualText);
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
  const summary = String(page.extract || "").trim();
  const excerpt = summary
    .replace(/\s+/g, " ")
    .split(/\s+/)
    .slice(0, 28)
    .join(" ");
  const concepts = toConceptKeywords(page.title || title, summary, categories);

  return {
    term: query,
    title: page.title || title,
    summary: excerpt,
    excerpt,
    categories,
    links: internalLinks,
    concepts,
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
