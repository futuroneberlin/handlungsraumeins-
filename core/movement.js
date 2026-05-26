function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function relationStrengthMap(relations = []) {
  const map = new Map();

  for (const relation of relations) {
    if (!Number.isInteger(relation.leftIndex) || !Number.isInteger(relation.rightIndex)) {
      continue;
    }

    const weight = Number(relation.semanticStrength || relation.score || relation.weight || 0);
    const leftKey = `${relation.leftIndex}:${relation.rightIndex}`;
    const rightKey = `${relation.rightIndex}:${relation.leftIndex}`;
    map.set(leftKey, weight);
    map.set(rightKey, weight);
  }

  return map;
}

function semanticMass(node) {
  const resonance = Number(node?.theoryResonanceScore || 0);
  const density = Number(node?.semanticDensity || 0);
  const base = Number(node?.weight || node?.mass || 1);
  return clamp(base + resonance * 1.6 + density * 1.25, 0.7, 5.2);
}

function attractorFor(node, viewport) {
  const width = viewport.width || 1280;
  const height = viewport.height || 800;
  const x = width * 0.5;
  const y = height * 0.48;

  if (node?.isTheoryAttractor) {
    return {
      x: Number.isFinite(node.targetX) ? node.targetX : node.x,
      y: Number.isFinite(node.targetY) ? node.targetY : node.y,
      depth: 0.36,
    };
  }

  if (node?.isTheoryCore) {
    return { x, y, depth: 0 };
  }

  const phase = String(node?.phase || "transformation");
  if (phase === "ingestion" || phase === "extraction") {
    return { x: width * 0.28, y: height * 0.5, depth: 1.45 };
  }

  if (phase === "formation") {
    return { x: width * 0.42, y: height * 0.5, depth: 1.22 };
  }

  if (phase === "stabilization" || phase === "foundation") {
    return { x: width * 0.72, y: height * 0.48, depth: 0.72 };
  }

  return { x, y, depth: 1.0 };
}

function targetDepth(node) {
  const resonance = Number(node?.theoryResonanceScore || 0);
  const density = Number(node?.semanticDensity || 0);
  return clamp(1.5 - resonance * 0.7 - density * 0.45, 0.25, 1.85);
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

  const seconds = Math.min(0.06, Math.max(0.01, delta / 1000));
  const strengthLookup = relationStrengthMap(safeRelations);

  for (let index = 0; index < safeFragments.length; index += 1) {
    const node = safeFragments[index];
    const attractor = attractorFor(node, safeViewport);
    const mass = semanticMass(node);
    const age = Number(node?.age || 0);
    const temporalFormation = clamp(age / 18, 0, 1);
    const resonance = Number(node?.theoryResonanceScore || 0);
    const density = Number(node?.semanticDensity || 0);

    if (node?.isTheoryCore) {
      node.x += (attractor.x - node.x) * 0.22;
      node.y += (attractor.y - node.y) * 0.22;
      node.vx = 0;
      node.vy = 0;
      node.z = 0;
      node.opacity = 1;
      node.atmosphericOpacity = 1;
      node.sizeScale = 1.55;
      continue;
    }

    if (node?.isTheoryAttractor) {
      node.x += (attractor.x - node.x) * 0.2;
      node.y += (attractor.y - node.y) * 0.2;
      node.vx = 0;
      node.vy = 0;
      node.z = 0.36;
      node.opacity = 0.9;
      node.atmosphericOpacity = 0.9;
      node.sizeScale = 1.14;
      node.depthBlur = 0.08;
      continue;
    }

    node.vx = Number(node.vx || 0);
    node.vy = Number(node.vy || 0);

    const dx = attractor.x - node.x;
    const dy = attractor.y - node.y;
    const gravity = 0.00072 + resonance * 0.00118 + density * 0.00086;

    node.vx += (dx * gravity) / mass;
    node.vy += (dy * gravity) / mass;

    // Soft structural reinforcement from strong relations only.
    for (let otherIndex = 0; otherIndex < safeFragments.length; otherIndex += 1) {
      if (otherIndex === index) {
        continue;
      }

      const edgeWeight = Number(strengthLookup.get(`${index}:${otherIndex}`) || 0);
      if (edgeWeight < 1.25) {
        continue;
      }

      const other = safeFragments[otherIndex];
      const ox = other.x - node.x;
      const oy = other.y - node.y;
      const dist = Math.max(1, Math.hypot(ox, oy));
      const ideal = clamp(248 - edgeWeight * 38, 128, 216);
      const pull = ((dist - ideal) * 0.00022 * edgeWeight) / mass;
      node.vx += (ox / dist) * pull;
      node.vy += (oy / dist) * pull;
    }

    // Slow architectural drift, not particle jitter.
    const driftPhase = Number(node?.driftPhase || node?.sequenceIndex || index) * 0.32;
    node.vx += Math.sin(time * 0.000045 + driftPhase) * 0.00038;
    node.vy += Math.cos(time * 0.00004 + driftPhase) * 0.00032;

    const damping = clamp(0.992 - resonance * 0.01 - temporalFormation * 0.006, 0.972, 0.994);
    node.vx *= damping;
    node.vy *= damping;

    node.x += node.vx * seconds * 60;
    node.y += node.vy * seconds * 60;

    const desiredDepth = targetDepth(node);
    node.z = clamp((node.z ?? desiredDepth) + (desiredDepth - (node.z ?? desiredDepth)) * 0.08, 0, 2);
    node.depthLayer = node.z < 0.7 ? 0 : node.z > 1.35 ? 2 : 1;
    node.sizeScale = clamp(0.78 + (2 - node.z) * 0.22 + density * 0.08, 0.72, 1.52);
    node.depthBlur = clamp(0.42 - (2 - node.z) * 0.12 + (1 - density) * 0.1, 0.04, 0.42);

    const relevance = clamp(resonance * 0.58 + density * 0.42, 0, 1);
    const ageFade = 1 - temporalFormation * 0.16;
    node.opacity = clamp(0.26 + relevance * 0.68, 0.2, 1) * ageFade;
    node.atmosphericOpacity = clamp(node.opacity * (0.82 + relevance * 0.24), 0.18, 1);

    node.x = clamp(node.x, 92, width - 92);
    node.y = clamp(node.y, 110, height - 86);
  }

  return safeFragments;
}
