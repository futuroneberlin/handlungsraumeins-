function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function updateSpatialMemory(fragments, delta) {
  const seconds = delta / 1000;

  for (const fragment of fragments) {
    fragment.age = (fragment.age || 0) + seconds * 0.8;
    fragment.traceX = fragment.traceX ?? fragment.x;
    fragment.traceY = fragment.traceY ?? fragment.y;
    fragment.traceX += (fragment.x - fragment.traceX) * 0.028;
    fragment.traceY += (fragment.y - fragment.traceY) * 0.028;

    const ageFade = 1 - fragment.age * 0.01;
    const densityBoost = 0.16 + (fragment.clusterMass || 1) * 0.06;
    const sedimentBoost = fragment.depthLayer === 2 ? 0.1 : fragment.depthLayer === 1 ? 0.04 : 0;
    fragment.memoryOpacity = clamp(ageFade + densityBoost + sedimentBoost, 0.1, 0.74);
    const archiveFade = fragment.depthLayer === 2 ? 0.00045 : 0.0008;
    fragment.opacity = clamp((fragment.opacity ?? 1) - seconds * archiveFade, 0.12, 1);
  }

  return fragments;
}