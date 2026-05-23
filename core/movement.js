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
    const link = {
      targetIndex: relation.rightIndex,
      sourceIndex: relation.leftIndex,
      type: relation.type || "semantic",
      weight: relation.score || 1,
      progress: relation.progress ?? 1,
    };
    const reverseLink = {
      targetIndex: relation.leftIndex,
      sourceIndex: relation.rightIndex,
      type: relation.type || "semantic",
      weight: relation.score || 1,
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

function estimateCollisionRadius(fragment) {
  const text = String(fragment.text || fragment.title || fragment.keyword || "");
  const layoutWidth = fragment.layoutWidth || Math.max(180, Math.min(360, 160 + text.length * 4.6));
  const lineCount = Math.max(1, Math.ceil(text.length / Math.max(16, Math.round(layoutWidth / 11))));
  const boxHeight = Math.max(26, lineCount * 19 + 18);
  const boxWidth = Math.max(80, layoutWidth);

  if (fragment.isTheoryCore) {
    return Math.max(128, Math.hypot(boxWidth, boxHeight) * 0.42);
  }

  return Math.max(24, Math.hypot(boxWidth, boxHeight) * 0.28);
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
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const leftX = width * 0.14;
  const centerLaneX = width * 0.5;
  const rightX = width * 0.82;
  const minDistance = Math.max(32, Math.min(width, height) * 0.05);

  buildRelationLookup(safeFragments, safeRelations);

  for (const fragment of safeFragments) {
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

    const mass = clamp(fragment.mass || fragment.clusterMass || fragment.weight || 1, 0.8, 3.2);
    const ageFactor = Math.min(1, (fragment.age || 0) / 16);
    const depthLayer = fragment.depthLayer || 1;
    const zoneX = depthLayer === 0 ? leftX : depthLayer === 1 ? centerLaneX : rightX;
    const flowX = Number.isFinite(fragment.targetX) ? fragment.targetX : zoneX;
    const flowY = Number.isFinite(fragment.targetY) ? fragment.targetY : (fragment.spawnY ?? fragment.y ?? centerY);
    const ageBias = Math.min(1, (fragment.age || 0) / 10);
    const targetX = flowX + (rightX - flowX) * ageBias * (depthLayer === 2 ? 0.18 : 0.44);
    const targetY = flowY + Math.sin(time * 0.00035 + (fragment.driftPhase || 0)) * 2.2;
    const dx = targetX - fragment.x;
    const dy = targetY - fragment.y;
    const spring = 0.0026 + (fragment.axisWeight || 0.5) * 0.0014;
    const damping = 0.9 - ageFactor * 0.06;

    fragment.vx = (fragment.vx || 0) + (dx * spring) / mass;
    fragment.vy = (fragment.vy || 0) + (dy * spring * 0.9) / mass;
    fragment.vx *= damping;
    fragment.vy *= damping;

    const flowPulse = 0.12 + ageBias * 0.18;
    fragment.vx += flowPulse * (depthLayer === 0 ? 0.4 : depthLayer === 2 ? 0.08 : 0.2);
    fragment.vy += Math.sin((time * 0.0004) + (fragment.sequenceIndex || 0)) * 0.0004;
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
    const relationStrength = Math.min(1.8, Math.max(0.6, relation.score || 1));
    const progress = relation.progress ?? 1;
    const idealDistance = clamp(230 - relationStrength * 22, 70, 220);
    const force = (distance - idealDistance) * 0.0005 * relationStrength * (0.55 + progress * 0.45);
    const nx = dx / distance;
    const ny = dy / distance;

    left.vx += nx * force;
    left.vy += ny * force * 0.66;
    right.vx -= nx * force;
    right.vy -= ny * force * 0.66;
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
        const repel = 0.018 / (distance * distance);
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
      const push = overlap * (sharedCluster ? 0.012 : 0.017) * (1 + depthGap * 0.14);
      const nx = dx / distance;
      const ny = dy / distance;
      left.vx -= nx * push;
      left.vy -= ny * push;
      right.vx += nx * push;
      right.vy += ny * push;
    }
  }

  for (const fragment of safeFragments) {
    const mass = clamp(fragment.mass || fragment.clusterMass || fragment.weight || 1, 0.8, 3.2);
    const depthLayer = fragment.depthLayer || 1;
    const ageFactor = Math.min(1, (fragment.age || 0) / 16);
    const centeringX = depthLayer === 0 ? leftX : depthLayer === 1 ? centerLaneX : rightX;
    const centeringY = fragment.targetY ?? centerY;
    fragment.vx += (centeringX - fragment.x) * 0.0007 / mass;
    fragment.vy += (centeringY - fragment.y) * 0.00045 / mass;

    fragment.x += fragment.vx * seconds * 60;
    fragment.y += fragment.vy * seconds * 60;
    fragment.vx *= 0.985;
    fragment.vy *= 0.985;

    fragment.z = clamp((fragment.z ?? fragment.depthLayer ?? 1) + (fragment.foregroundBias || 0) * 0.0012 - seconds * 0.0008, 0, 2);
    const fadeRate = depthLayer === 2 ? 0.0016 : depthLayer === 0 ? 0.0009 : 0.0011;
    fragment.opacity = clamp((fragment.opacity || 1) - seconds * (fadeRate + ageFactor * 0.0006), 0.2, 1);

    fragment.x = clamp(fragment.x, 28, width - 28);
    fragment.y = clamp(fragment.y, 42, height - 28);
  }

  return safeFragments;
}
