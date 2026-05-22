function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function updateFragments(fragments, viewport, time, delta) {
  if (!fragments.length) {
    return fragments;
  }

  const seconds = delta / 1000;
  const centerX = viewport.width * 0.5;
  const centerY = viewport.height * 0.5;
  const voidRadiusX = viewport.width * 0.15;
  const voidRadiusY = viewport.height * 0.13;

  for (const fragment of fragments) {
    const ageFactor = Math.min(1, (fragment.age || 0) / 180);
    const depthLayer = fragment.depthLayer || 1;
    const depthFactor = depthLayer === 2 ? 0.28 : depthLayer === 0 ? 1 : 0.72;
    const semanticPull = (0.0022 + (fragment.axisWeight || 0.5) * 0.0032) * depthFactor;
    const instability = Math.max(0.35, 1 - ageFactor * 0.52);
    const orbitalX = Math.sin(time * fragment.orbitSpeed * 0.001 + fragment.driftPhase) * fragment.orbitRadius * instability * depthFactor;
    const orbitalY = Math.cos(time * fragment.orbitSpeed * 0.0008 + fragment.driftPhase * 1.2) * fragment.orbitRadius * 0.7 * instability * depthFactor;
    const goalX = fragment.targetX + orbitalX;
    const goalY = fragment.targetY + orbitalY;
    const dxFromCenter = fragment.x - centerX;
    const dyFromCenter = fragment.y - centerY;
    const inVoid = Math.abs(dxFromCenter) < voidRadiusX && Math.abs(dyFromCenter) < voidRadiusY;
    const voidPushX = inVoid ? Math.sign(dxFromCenter || 1) * (voidRadiusX - Math.abs(dxFromCenter)) * 0.005 : 0;
    const voidPushY = inVoid ? Math.sign(dyFromCenter || 1) * (voidRadiusY - Math.abs(dyFromCenter)) * 0.005 : 0;
    const gravity = fragment.gravity || 0.8;

    fragment.vx = (fragment.vx || 0) + (goalX - fragment.x) * semanticPull * gravity + voidPushX;
    fragment.vy = (fragment.vy || 0) + (goalY - fragment.y) * semanticPull * gravity + voidPushY;
    fragment.vx *= 0.88 - ageFactor * 0.04;
    fragment.vy *= 0.88 - ageFactor * 0.04;
    fragment.x += fragment.vx * seconds * (14 + gravity * 6) * depthFactor;
    fragment.y += fragment.vy * seconds * (14 + gravity * 6) * depthFactor;
    fragment.z = clamp((fragment.z ?? fragment.depthLayer ?? 1) + (fragment.foregroundBias || 0) * 0.0015 - seconds * 0.001, 0, 2);
    const fadeRate = depthLayer === 2 ? 0.0018 : depthLayer === 0 ? 0.001 : 0.0012;
    fragment.opacity = clamp((fragment.opacity || 1) - seconds * (fadeRate + ageFactor * 0.0008), 0.14, 1);
  }

  const minDistance = 58;
  for (let leftIndex = 0; leftIndex < fragments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < fragments.length; rightIndex += 1) {
      const left = fragments[leftIndex];
      const right = fragments[rightIndex];
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = Math.hypot(dx, dy) || 0.001;

      if (distance >= minDistance) {
        continue;
      }

      const sharedCluster = left.clusterKey === right.clusterKey;
      const depthGap = Math.abs((left.depthLayer || 1) - (right.depthLayer || 1));
      const push = (minDistance - distance) * (sharedCluster ? 0.00055 : 0.0009) * (1 + depthGap * 0.12);
      const nx = dx / distance;
      const ny = dy / distance;
      left.x -= nx * push;
      left.y -= ny * push;
      right.x += nx * push;
      right.y += ny * push;
    }
  }

  for (const fragment of fragments) {
    fragment.x = clamp(fragment.x, 34, viewport.width - 34);
    fragment.y = clamp(fragment.y, 54, viewport.height - 34);
  }

  return fragments;
}
