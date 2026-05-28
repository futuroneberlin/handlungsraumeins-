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

function semanticPhysicsFor(node) {
  const physics = node?.semanticPhysics || {};
  const resonance = clamp(Number(node?.theoryResonanceScore || 0), 0, 1);
  const density = clamp(Number(node?.semanticDensity || 0), 0, 1);
  return {
    mass: Number(physics.semanticMass || semanticMass(node)),
    pull: Number(physics.forcePull || (0.018 + resonance * 0.052 + density * 0.01)),
    damping: Number.isFinite(physics.damping) ? physics.damping : clamp(0.974 + resonance * 0.016, 0.972, 0.994),
    collisionRadius: Number(physics.collisionRadius || (72 + resonance * 46 + density * 18)),
    orbitRadius: Number(physics.orbitRadius || (220 - resonance * 96 - density * 22)),
    orbitSpeed: Number(physics.orbitSpeed || (0.0016 - resonance * 0.00092)),
    persistence: Number(physics.persistence || (0.2 + resonance * 0.76)),
    opacity: Number(physics.opacity || 0.5),
    depth: Number(physics.depth || 1),
    depthLift: Number(physics.depthLift || (8 + resonance * 14)),
  };
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
    const physics = semanticPhysicsFor(node);
    const mass = physics.mass;
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
    const gravity = physics.pull + resonance * 0.00072 + density * 0.00042;

    node.vx += (dx * gravity) / mass;
    node.vy += (dy * gravity) / mass;

    const orbitSeed = Number(node.orbitSeed || node.index || index) * 0.91;
    node.orbitPhase = Number.isFinite(node.orbitPhase) ? node.orbitPhase : orbitSeed;
    node.orbitPhase += physics.orbitSpeed * (0.86 + (1 - resonance) * 0.72);
    const orbitRadius = physics.orbitRadius * (0.72 + density * 0.22 - resonance * 0.12);
    const orbitTargetX = attractor.x + Math.cos(node.orbitPhase) * orbitRadius;
    const orbitTargetY = attractor.y + Math.sin(node.orbitPhase) * orbitRadius * 0.78;
    const orbitForce = 0.00028 + (1 - resonance) * 0.00034;
    node.vx += (orbitTargetX - node.x) * orbitForce;
    node.vy += (orbitTargetY - node.y) * orbitForce;

    // Soft structural reinforcement from strong relations only.
    for (let otherIndex = 0; otherIndex < safeFragments.length; otherIndex += 1) {
      if (otherIndex === index) {
        continue;
      }

      const edgeWeight = Number(strengthLookup.get(`${index}:${otherIndex}`) || 0);
      if (edgeWeight < 0.9) {
        continue;
      }

      const other = safeFragments[otherIndex];
      const ox = other.x - node.x;
      const oy = other.y - node.y;
      const dist = Math.max(1, Math.hypot(ox, oy));
      const ideal = clamp(240 - edgeWeight * 44, 112, 220);
      const pull = ((dist - ideal) * 0.00024 * edgeWeight) / mass;
      node.vx += (ox / dist) * pull;
      node.vy += (oy / dist) * pull;
    }

    // Slow architectural drift, not particle jitter.
    const driftPhase = Number(node?.driftPhase || node?.sequenceIndex || index) * 0.32;
    node.vx += Math.sin(time * 0.000032 + driftPhase) * (0.00054 - resonance * 0.00028);
    node.vy += Math.cos(time * 0.000029 + driftPhase) * (0.00048 - resonance * 0.00022);

    const damping = clamp(physics.damping - resonance * 0.006 - temporalFormation * 0.003, 0.936, 0.995);
    node.vx *= damping;
    node.vy *= damping;

    node.x += node.vx * seconds * 60;
    node.y += node.vy * seconds * 60;

    const desiredDepth = targetDepth(node);
    node.z = clamp((node.z ?? desiredDepth) + (desiredDepth - (node.z ?? desiredDepth)) * (0.08 + resonance * 0.03), 0, 2);
    node.depthLayer = node.z < 0.7 ? 0 : node.z > 1.35 ? 2 : 1;
    node.sizeScale = clamp(0.62 + resonance * 0.58 + density * 0.2 - node.z * 0.06, 0.6, 1.88);
    node.depthBlur = clamp(0.56 - resonance * 0.2 + (1 - density) * 0.1 + Math.max(0, node.z - 1) * 0.1, 0.04, 0.52);

    const relevance = clamp(resonance * 0.66 + density * 0.34, 0, 1);
    const ageFade = 1 - temporalFormation * 0.14;
    node.opacity = clamp(0.1 + relevance * 0.84, 0.05, 1) * ageFade;
    node.atmosphericOpacity = clamp(node.opacity * (0.74 + relevance * 0.3), 0.08, 1);
    node.persistence = physics.persistence;

    node.x = clamp(node.x, 92, width - 92);
    node.y = clamp(node.y, 110, height - 86);

    if (relevance < 0.16 && age > 16) {
      node.opacity = clamp(node.opacity * 0.92, 0.04, 1);
      node.atmosphericOpacity = clamp(node.atmosphericOpacity * 0.9, 0.04, 1);
    }
  }

  return safeFragments;
}
