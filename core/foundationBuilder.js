import { createFoundationState } from "./layout.js";

export function buildFoundationTerms(terms, viewport) {
  // lightweight normalization: attach foundation metadata
  const foundation = createFoundationState(viewport || { width: 1280, height: 800 });
  const normalizedTerms = (terms || []).map((term) => (typeof term === "string" ? { text: term, keyword: term } : term));
  const built = normalizedTerms.map((term, idx) => {
    const role = term.role || (idx === 0 ? "central" : idx < 3 ? "secondary" : "peripheral");
    const sizeScale = role === "central" ? 1.28 : role === "secondary" ? 1.04 : 0.86;
    const lane = typeof term.preferredLane === "number" ? term.preferredLane : idx % 3;
    const depth = role === "central" ? 0 : role === "secondary" ? 1 : 2;
    return {
      ...term,
      text: term.text || term.keyword || String(term),
      keyword: term.keyword || term.text || String(term),
      phase: "foundation",
      preferredLane: lane,
      preferredDepthLayer: depth,
      layoutWidth: Math.round(foundation.textWidth * Math.max(0.76, sizeScale)),
      sizeScale,
      axisWeight: role === "central" ? 0.92 : 0.6,
      stabilizeAt: performance.now() + (role === "central" ? 2600 : role === "secondary" ? 1800 : 1200),
      placed: false,
      visible: true,
      opacity: role === "central" ? 1 : role === "secondary" ? 0.94 : 0.82,
    };
  });

  return built;
}
