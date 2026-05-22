function relationScore(left, right) {
  const leftKeywords = left.keywords || [];
  const rightKeywords = right.keywords || [];
  const sharedKeywords = leftKeywords.filter((keyword) => rightKeywords.includes(keyword));
  const leftIndex = Number.isFinite(left.index) ? left.index : Number.isFinite(left.sequenceIndex) ? left.sequenceIndex : 0;
  const rightIndex = Number.isFinite(right.index) ? right.index : Number.isFinite(right.sequenceIndex) ? right.sequenceIndex : 0;
  const proximityScore = Math.max(0, 1 - Math.abs(leftIndex - rightIndex) / 24);
  const sourceScore = left.source === right.source ? 0.25 : 0;
  const sharedScore = sharedKeywords.length * 1.1;
  const massScore = Math.min(left.weight || 0.5, right.weight || 0.5) * 0.45;
  const groupLeft = left.semanticGroup || null;
  const groupRight = right.semanticGroup || null;
  const groupScore = groupLeft && groupRight && groupLeft === groupRight ? 0.62 : 0;
  const bridgePairs = new Set([
    "Raum|Konstruktion",
    "Konstruktion|Raum",
    "Handlung|Gesellschaft",
    "Gesellschaft|Handlung",
    "Handlung|Kunst",
    "Kunst|Handlung",
    "Kunst|Gesellschaft",
    "Gesellschaft|Kunst",
  ]);
  const bridgeScore = bridgePairs.has(`${groupLeft}|${groupRight}`) ? 0.34 : 0;
  return {
    score: sharedScore + proximityScore + sourceScore + massScore + groupScore + bridgeScore,
    sharedKeywords,
  };
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function buildRelations(fragments, wikiEntries = [], timestamp = now()) {
  const relations = [];

  for (let leftIndex = 0; leftIndex < fragments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < fragments.length; rightIndex += 1) {
      const left = fragments[leftIndex];
      const right = fragments[rightIndex];
      const { score, sharedKeywords } = relationScore(left, right);

      const sequentialBoost = rightIndex === leftIndex + 1 ? 0.22 : 0;
      const repetitionBoost = Math.max(left.repetition || 0, right.repetition || 0) * 0.03;
      const adjustedScore = score + sequentialBoost + repetitionBoost;

      if (adjustedScore < 0.9) {
        continue;
      }

      const type = sharedKeywords.length > 1 ? "semantic" : left.clusterKey === right.clusterKey ? "drift" : "semantic";
      const ttl = type === "wiki" ? 6500 : type === "drift" ? 9800 : 16000;

      relations.push({
        leftIndex,
        rightIndex,
        score: adjustedScore,
        type,
        label: sharedKeywords[0] || null,
        bornAt: timestamp,
        ttl,
      });
    }
  }

  for (const entry of wikiEntries) {
    const term = (entry.title || entry.term || "").toLowerCase();
    if (!term) {
      continue;
    }

    const matches = fragments.filter((fragment) => fragment.keywords.some((keyword) => term.includes(keyword) || keyword.includes(term)));
    for (let index = 0; index < matches.length - 1; index += 1) {
      if (index > 1) {
        break;
      }
      relations.push({
        leftIndex: fragments.indexOf(matches[index]),
        rightIndex: fragments.indexOf(matches[index + 1]),
        score: 1.18,
        type: "wiki",
        label: entry.title || term,
        bornAt: timestamp,
        ttl: 5400,
      });
    }
  }

  return relations
    .filter((relation) => relation.leftIndex >= 0 && relation.rightIndex >= 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(64, fragments.length * 2));
}

export function updateRelationLayer(relations, timestamp = now()) {
  return relations
    .map((relation) => {
      const age = timestamp - relation.bornAt;
      const progress = Math.max(0, 1 - age / relation.ttl);
      const wobble = relation.type === "wiki" ? 1 : relation.type === "drift" ? 0.84 : 0.92;
      return {
        ...relation,
        age,
        progress,
        opacity: progress * (relation.type === "wiki" ? 0.24 : relation.type === "drift" ? 0.14 : 0.1) * wobble,
      };
    })
    .filter((relation) => relation.progress > 0.14);
}
