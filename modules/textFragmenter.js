const DEFAULT_STOP_WORDS = new Set([
  "und",
  "oder",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einer",
  "einem",
  "eines",
  "ist",
  "sind",
  "war",
  "waren",
  "mit",
  "für",
  "auf",
  "von",
  "im",
  "in",
  "am",
  "an",
  "zu",
  "dem",
  "den",
  "des",
  "this",
  "that",
  "and",
  "the",
  "with",
  "for",
  "from",
  "into",
  "onto",
]);

export function normalizeText(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function splitIntoSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractKeywords(text, limit = 4) {
  const words = normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !DEFAULT_STOP_WORDS.has(word));

  const frequency = new Map();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function createConceptExcerpt(text = "", maxWords = 18) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return "";
  }

  const words = normalized.split(/\s+/);
  if (words.length <= maxWords) {
    return normalized;
  }

  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function createSemanticFragment(text, options = {}) {
  const source = options.source || "unbekannt";
  const keywords = extractKeywords(text, options.keywordLimit || 4);
  const excerpt = createConceptExcerpt(text, options.excerptWords || 18);
  const title = options.title || keywords[0] || source;

  return {
    title,
    source,
    excerpt,
    keywords,
    concept: keywords[0] || title,
  };
}

function createSignature(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createChunkBuffer(sentences, maxLength) {
  const chunks = [];
  let buffer = "";

  for (const sentence of sentences) {
    if (!buffer.length) {
      buffer = sentence;
      continue;
    }

    if (buffer.length + sentence.length + 1 <= maxLength) {
      buffer = `${buffer} ${sentence}`;
      continue;
    }

    chunks.push(buffer);
    buffer = sentence;
  }

  if (buffer.length) {
    chunks.push(buffer);
  }

  return chunks;
}

function splitIntoBlocks(text) {
  return normalizeText(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => block.replace(/\s*\n\s*/g, " "));
}

export function createFragments(text, options = {}) {
  const source = options.source || "unbekannt";
  const maxFragments = options.maxFragments || 72;
  const cleanText = normalizeText(text);
  const frequencyMap = options.frequencyMap || null;

  if (!cleanText) {
    return [];
  }

  const blocks = splitIntoBlocks(text);
  const blockPool = blocks.length ? blocks : [cleanText];
  const chunkSize = cleanText.length > 1800 ? 200 : cleanText.length > 900 ? 152 : 118;
  const chunks = blockPool.flatMap((block) => {
    const sentences = splitIntoSentences(block);
    const normalizedSentences = sentences.length ? sentences : [block];
    return createChunkBuffer(normalizedSentences, chunkSize);
  })
    .slice(0, maxFragments)
    .filter((chunk) => chunk.length >= 18)
    .map((chunk, index) => {
      const keywords = extractKeywords(chunk, 4);
      const density = Math.min(1, keywords.length / 4 + chunk.split(/\s+/).length / 48);
      const rarity = frequencyMap
        ? Math.max(0.22, Math.min(1, keywords.reduce((score, keyword) => score + 1 / Math.max(1, frequencyMap.get(keyword) || 1), 0) / Math.max(1, keywords.length)))
        : 0.62;
      return {
        id: `${source}-${index}`,
        source,
        index,
        text: chunk,
        keywords,
        keyword: keywords[0] || source,
        weight: Math.min(1, chunk.length / 260 + density * 0.24),
        rarity,
        repetition: keywords.reduce((score, keyword) => score + Math.max(0, (frequencyMap?.get(keyword) || 1) - 1), 0),
        blockIndex: index,
        signature: createSignature(`${source}:${chunk}`),
      };
    });

  return chunks;
}
