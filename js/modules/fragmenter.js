const STOPWORDS = new Set([
  "aber",
  "auch",
  "aus",
  "bei",
  "dass",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "ein",
  "eine",
  "einer",
  "eines",
  "für",
  "ist",
  "mit",
  "nicht",
  "oder",
  "sein",
  "sich",
  "und",
  "von",
  "wie",
  "wird",
]);

function splitIntoFragments(text) {
  return text
    .split(/(?<=[.!?])\s+|(?<=:)\s+|(?<=;)\s+/u)
    .flatMap((chunk) => {
      if (chunk.length <= 160) {
        return [chunk];
      }

      return chunk.split(/,\s+/u);
    })
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length >= 24);
}

function extractTerms(text) {
  const matches = text.match(/\p{L}{5,}/gu) ?? [];
  return [...new Set(
    matches
      .map((term) => term.toLowerCase())
      .filter((term) => !STOPWORDS.has(term))
  )];
}

export function fragmentTextBlocks(blocks) {
  return blocks.flatMap((block, blockIndex) =>
    splitIntoFragments(block.text).map((fragmentText, fragmentIndex) => ({
      id: `${block.source}-${block.page ?? 0}-${blockIndex}-${fragmentIndex}`,
      source: block.source,
      page: block.page ?? null,
      text: fragmentText,
      terms: extractTerms(fragmentText),
      emphasis: Math.min(1.35, 0.92 + fragmentText.length / 180),
    }))
  );
}
