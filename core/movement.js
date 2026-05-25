function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildRelationLookup(fragments, relations) {
  const lookup = new Map();

  for (const fragment of fragments) {
    lookup.set(fragment.index, []);
    fragment.links = [];
  }

  for (const relation of relations || []) {
    if (!Number.isInteger(relation.leftIndex) || !Number.isInteger(relation.rightIndex)) {
      continue;
    }

    const leftLinks = lookup.get(relation.leftIndex) || [];
    const rightLinks = lookup.get(relation.rightIndex) || [];
    const semanticStrength = relation.semanticStrength || relation.score || 1;

    const link = {
      targetIndex: relation.rightIndex,
      sourceIndex: relation.leftIndex,
      type: relation.type || "semantic",
      weight: relation.score || 1,
      semanticStrength,
      progress: relation.progress ?? 1,
    };

    const reverseLink = {
      targetIndex: relation.leftIndex,
      sourceIndex: relation.rightIndex,
      type: relation.type || "semantic",
      weight: relation.score || 1,
      semanticStrength,
      progress: relation.progress ?? 1,
    };

    leftLinks.push(link);
    rightLinks.push(reverseLink);
    lookup.set(relation.leftIndex, leftLinks);
    lookup.set(relation.rightIndex, rightLinks);
  }

  for (const fragment of fragments) {
    fragment.links = lookup.get(fragment.index) || [];
  }

  return lookup;
}

function relationMass(fragment) {
  if (!fragment) {
    return 1;
  }

  const links = Array.isArray(fragment.links) ? fragment.links : [];
  let totalStrength = 0;
  let totalWeight = 0;

  for (const link of links) {
    totalStrength += Number(link.semanticStrength || link.weight || 0);
    totalWeight += Number(link.weight || 0);
  }

  const semanticDensity = Number(fragment.semanticDensity || 0);
  const resonance = Number(fragment.theoryResonanceScore || 0);
  const base = Number(fragment.mass || fragment.clusterMass || fragment.weight || 1);

  return clamp(base + semanticDensity * 0.9 + resonance * 1.2 + totalStrength * 0.08 + totalWeight * 0.03, 0.7, 4.8);
}

function updateSpatialBody(fragment, time, relationLoad, viewportWidth, viewportHeight) {
  const ageFactor = Math.min(1, (fragment.age || 0) / 18);
  const resonance = Number(fragment.theoryResonanceScore || 0);
  const semanticDensity = Number(fragment.semanticDensity || 0);
  const linkDensity = clamp(relationLoad / 8, 0, 1);
  const gravity = clamp(resonance * 0.52 + semanticDensity * 0.34 + linkDensity * 0.28, 0, 1.4);
  const depthTarget = clamp((fragment.depthLayer || 1) - resonance * 0.32 + semanticDensity * 0.24 - ageFactor * 0.18, 0, 2);

  fragment.z = clamp((fragment.z ?? depthTarget) + (depthTarget - (fragment.z ?? depthTarget)) * 0.12 + gravity * 0.01, 0, 2);
  fragment.sizeScale = clamp((fragment.sizeScale || 1) + (fragment.z - 1) * 0.08 + resonance * 0.05 + semanticDensity * 0.04, 0.72, 1.65);
  fragment.foregroundBias = clamp((fragment.foregroundBias || 0.15) + resonance * 0.04 + semanticDensity * 0.03 - ageFactor * 0.02, 0, 0.55);
  fragment.depthBlur = clamp(0.45 - fragment.z * 0.14 + (1 - semanticDensity) * 0.16, 0.03, 0.45);
  fragment.atmosphericOpacity = clamp(0.28 + fragment.z * 0.28 + resonance * 0.2 + semanticDensity * 0.18, 0.22, 1);

  const centerX = viewportWidth * 0.5;
  const centerY = viewportHeight * 0.49;
  const vortexX = centerX + Math.sin(time * 0.00018 + (fragment.sequenceIndex || 0)) * viewportWidth * 0.012;
  const vortexY = centerY + Math.cos(time * 0.00016 + (fragment.sequenceIndex || 0) * 0.7) * viewportHeight * 0.014;
  fragment.vx += (vortexX - fragment.x) * gravity * 0.00012;
  fragment.vy += (vortexY - fragment.y) * gravity * 0.0001;
}

function estimateCollisionRadius(fragment) {
  const text = String(fragment.text || fragment.title || fragment.keyword || "");
  const layoutWidth = fragment.layoutWidth || Math.max(180, Math.min(360, 160 + text.length * 4.6));
  const lineCount = Math.max(1, Math.ceil(text.length / Math.max(16, Math.round(layoutWidth / 11))));
  const boxHeight = Math.max(26, lineCount * 19 + 18);
  const boxWidth = Math.max(80, layoutWidth);
  const sizeScale = fragment.sizeScale || 1;
  const padding = fragment.phase === "foundation" ? 1.16 : fragment.depthLayer === 0 ? 1.08 : 1;

  if (fragment.isTheoryCore) {
    return Math.max(140, Math.hypot(boxWidth, boxHeight) * 0.46 * sizeScale);
  }

  return Math.max(28, Math.hypot(boxWidth, boxHeight) * 0.31 * sizeScale * padding);
}

export function updateFragments(fragments, relations, viewport, time, delta) {
  const safeFragments = Array.isArray(fragments) ? fragments : [];
  const safeRelations = Array.isArray(relations) ? relations : [];
  const safeViewport = viewport || { width: 0, height: 0 };
  const width = safeViewport.width || 0;
  const height = safeViewport.height || 0;

  if (!safeFragments.length || width <= 0 || height <= 0) {
    return safeFragments;
  }

  const seconds = Math.min(0.05, Math.max(0.008, delta / 1000));
  const leftX = width * 0.14;
  const centerLaneX = width * 0.5;
  const rightX = width * 0.82;
  const centerY = height * 0.52;
  const minDistance = Math.max(38, Math.min(width, height) * 0.06);

  buildRelationLookup(safeFragments, safeRelations);

  for (let index = 0; index < safeFragments.length; index += 1) {
    const fragment = safeFragments[index];

    if (fragment.isTheoryCore) {
      const targetX = width * 0.5;
      const targetY = height * 0.46;
      fragment.x += (targetX - fragment.x) * 0.24;
      fragment.y += (targetY - fragment.y) * 0.24;
      fragment.vx = 0;
      fragment.vy = 0;
      fragment.z = 0;
      fragment.opacity = 1;
      fragment.memoryOpacity = 1;
      fragment.layoutWidth = Math.max(fragment.layoutWidth || 0, Math.min(width * 0.34, 420));
      continue;
    }

    const relationLoad = Array.isArray(fragment.links) ? fragment.links.length : 0;
    const mass = relationMass(fragment);
    const ageFactor = Math.min(1, (fragment.age || 0) / 16);
    const depthLayer = fragment.depthLayer || 1;
    const zoneX = depthLayer === 0 ? leftX : depthLayer === 1 ? centerLaneX : rightX;
    const flowX = Number.isFinite(fragment.targetX) ? fragment.targetX : zoneX;
    const flowY = Number.isFinite(fragment.targetY) ? fragment.targetY : (fragment.spawnY ?? fragment.y ?? centerY);
    const ageBias = Math.min(1, (fragment.age || 0) / 10);
    const semanticGravity = clamp((fragment.theoryResonanceScore || 0) * 0.56 + (fragment.semanticDensity || 0) * 0.32 + Math.min(1, relationLoad / 6) * 0.24, 0, 1.2);
    const driftPhase = fragment.driftPhase || 0;
    const targetX = flowX + (rightX - flowX) * ageBias * (depthLayer === 2 ? 0.16 : 0.38) + Math.sin(time * 0.00021 + driftPhase) * 8 * semanticGravity;
    const targetY = flowY + Math.sin(time * 0.00035 + driftPhase) * (2.2 + semanticGravity * 1.8);
    const dx = targetX - fragment.x;
    const dy = targetY - fragment.y;
    const spring = 0.0021 + (fragment.axisWeight || 0.5) * 0.0011 + semanticGravity * 0.0012;
    const damping = 0.906 - ageFactor * 0.055 - semanticGravity * 0.012;

    fragment.vx = (fragment.vx || 0) + (dx * spring) / mass;
    fragment.vy = (fragment.vy || 0) + (dy * spring * 0.9) / mass;
    fragment.vx *= damping;
    fragment.vy *= damping;

    const flowPulse = 0.11 + ageBias * 0.16 + semanticGravity * 0.06;
    fragment.vx += flowPulse * (depthLayer === 0 ? 0.44 : depthLayer === 2 ? 0.08 : 0.18);
    fragment.vy += Math.sin((time * 0.0004) + (fragment.sequenceIndex || 0)) * 0.00035;

    updateSpatialBody(fragment, time, relationLoad, width, height);
  }

  for (const relation of safeRelations) {
    const left = safeFragments[relation.leftIndex];
    const right = safeFragments[relation.rightIndex];
    if (!left || !right) {
      continue;
    }

    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const relationStrength = Math.min(2.4, Math.max(0.45, relation.semanticStrength || relation.score || 1));
    const progress = relation.progress ?? 1;
    const idealDistance = clamp(relation.type === "theory" ? 172 : relation.type === "wiki" ? 166 : 214 - relationStrength * 16, 68, 224);
    const force = (distance - idealDistance) * 0.0005 * relationStrength * (0.52 + progress * 0.48);
    const nx = dx / distance;
    const ny = dy / distance;

    left.vx += nx * force;
    left.vy += ny * force * 0.66;
    right.vx -= nx * force;
    right.vy -= ny * force * 0.66;

    const curveBias = relationStrength * 0.00012;
    left.vx += ny * curveBias;
    left.vy -= nx * curveBias;
    right.vx -= ny * curveBias;
    right.vy += nx * curveBias;
  }

  for (let leftIndex = 0; leftIndex < safeFragments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < safeFragments.length; rightIndex += 1) {
      const left = safeFragments[leftIndex];
      const right = safeFragments[rightIndex];
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const collisionDistance = Math.max(minDistance, estimateCollisionRadius(left) + estimateCollisionRadius(right));

      if (distance >= collisionDistance) {
        const repel = 0.024 / (distance * distance);
        const nx = dx / distance;
        const ny = dy / distance;
        left.vx -= nx * repel;
        left.vy -= ny * repel;
        right.vx += nx * repel;
        right.vy += ny * repel;
        continue;
      }

      const sharedCluster = left.clusterKey === right.clusterKey;
      const depthGap = Math.abs((left.depthLayer || 1) - (right.depthLayer || 1));
      const overlap = (collisionDistance - distance) / collisionDistance;
      const push = overlap * (sharedCluster ? 0.018 : 0.024) * (1 + depthGap * 0.18);
      const nx = dx / distance;
      const ny = dy / distance;
      left.vx -= nx * push;
      left.vy -= ny * push;
      right.vx += nx * push;
      right.vy += ny * push;

      if (sharedCluster) {
        left.z = clamp((left.z || 1) + 0.004, 0, 2);
        right.z = clamp((right.z || 1) + 0.004, 0, 2);
      }
    }
  }

  for (const fragment of safeFragments) {
    const mass = clamp(fragment.mass || fragment.clusterMass || fragment.weight || 1, 0.7, 4.4);
    const depthLayer = fragment.depthLayer || 1;
    const ageFactor = Math.min(1, (fragment.age || 0) / 16);
    const centeringX = depthLayer === 0 ? leftX : depthLayer === 1 ? centerLaneX : rightX;
    const centeringY = fragment.targetY ?? centerY;
    const resonancePull = clamp((fragment.theoryResonanceScore || 0) * 0.34 + (fragment.semanticDensity || 0) * 0.26, 0, 0.9);

    fragment.vx += ((centeringX - fragment.x) * (0.00058 + resonancePull * 0.00018)) / mass;
    fragment.vy += ((centeringY - fragment.y) * (0.0004 + resonancePull * 0.00012)) / mass;

    fragment.x += fragment.vx * seconds * 60;
    fragment.y += fragment.vy * seconds * 60;
    fragment.vx *= 0.977;
    fragment.vy *= 0.977;

    const layerBias = depthLayer === 0 ? 0.36 : depthLayer === 2 ? 1.62 : 0.98;
    fragment.z = clamp((fragment.z ?? fragment.depthLayer ?? 1) + (fragment.foregroundBias || 0) * 0.0012 + resonancePull * 0.008 - seconds * 0.00045 * layerBias, 0, 2);
    const fadeRate = depthLayer === 2 ? 0.00145 : depthLayer === 0 ? 0.00082 : 0.00105;
    fragment.opacity = clamp((fragment.opacity || 1) - seconds * (fadeRate + ageFactor * 0.00055) + resonancePull * 0.0008, 0.18, 1);
    fragment.atmosphericOpacity = clamp((fragment.atmosphericOpacity || fragment.opacity || 1) * 0.995 + fragment.opacity * 0.005, 0.16, 1);

    fragment.x = clamp(fragment.x, 28, width - 28);
    fragment.y = clamp(fragment.y, 42, height - 28);
  }

  return safeFragments;
}
