import { evaluateTheoryResonance } from "../core/theoryModel.js";

const DEFAULT_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const REST_SUMMARY_ENDPOINT = "https://en.wikipedia.org/api/rest_v1/page/summary/";

const ALLOWED_THEME_TERMS = [
  "joseph beuys",
  "social sculpture",
  "process art",
  "participatory art",
  "relational aesthetics",
  "architecture",
  "space",
  "embodiment",
  "temporality",
  "collective practice",
  "aesthetic experience",
  "john dewey",
  "georg w bertram",
  "sculpture",
  "performance",
  "ritual",
  "urban practice",
  "spatial theory",
];

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

function matchesAllowedTheme(value) {
  const normalized = normalizeTerm(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  return ALLOWED_THEME_TERMS.some((term) => normalized.includes(term));
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

  const extracted = [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([word]) => word)
    .filter(isConceptualText);

  return [...new Set([
    ...extracted,
    ...categories.slice(0, 4).filter(isConceptualText),
  ])].slice(0, 6);
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

async function fetchRestSummary(title) {
  const url = `${REST_SUMMARY_ENDPOINT}${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  if (!data) {
    return null;
  }

  return {
    title: data.title || title,
    summary: normalizeTerm(data.extract || data.description || ""),
    excerpt: normalizeTerm(data.extract || data.description || ""),
    pageid: data.pageid,
    url: data.content_urls?.desktop?.page || data.content_urls?.mobile?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent((data.title || title).replace(/\s+/g, "_"))}`,
  };
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
  const restSummary = await fetchRestSummary(title);
  const detailUrl = `${DEFAULT_ENDPOINT}?action=query&titles=${encodeURIComponent(title)}&prop=extracts|categories|links|info&inprop=url&exintro=1&explaintext=1&cllimit=max&plnamespace=0&pllimit=max&redirects=1&format=json&origin=*`;
  const data = await fetchJson(detailUrl);
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const page = pages[0];
  if (!page) {
    return null;
  }

  const categories = extractListTitles(page.categories, "Category:").slice(0, 12);
  const internalLinks = extractListTitles(page.links).slice(0, 24);
  const summary = normalizeTerm(restSummary?.summary || page.extract || "");
  const excerpt = summary
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ")
    .split(/\s+/)
    .slice(0, 34)
    .join(" ");
  const concepts = toConceptKeywords(page.title || title, summary, categories);
  const resonance = evaluateTheoryResonance([
    page.title || title,
    summary,
    ...categories,
    ...internalLinks.slice(0, 10),
    ...concepts,
  ], { minScore: 1.65 });

  const allowedThemeHit = matchesAllowedTheme(page.title || title) || matchesAllowedTheme(summary) || categories.some(matchesAllowedTheme) || concepts.some(matchesAllowedTheme);

  if (!allowedThemeHit || (resonance.reject && concepts.length < 2)) {
    return null;
  }

  const resonanceScore = Number((resonance.score + concepts.length * 0.14).toFixed(3));

  return {
    term: query,
    title: page.title || title,
    summary,
    excerpt,
    categories: categories.slice(0, 8),
    links: internalLinks.slice(0, 12),
    concepts: concepts.slice(0, 8),
    theoryDimensions: resonance.activatedDimensions,
    resonanceScore,
    pageid: page.pageid,
    url: restSummary?.url || page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title || title).replace(/\s+/g, "_"))}`,
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
