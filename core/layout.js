function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createAnchors(width, height) {
  const marginX = width * 0.11;
  const marginY = height * 0.12;
  return [
    { x: marginX, y: marginY, axis: 0.2 },
    { x: width - marginX, y: marginY + height * 0.08, axis: -0.18 },
    { x: marginX * 0.9, y: height * 0.5, axis: 1.5 },
    { x: width - marginX * 0.88, y: height * 0.5, axis: 1.62 },
    { x: marginX * 1.12, y: height - marginY, axis: 0.86 },
    { x: width - marginX * 1.12, y: height - marginY * 0.92, axis: 2.32 },
    { x: width * 0.5, y: marginY * 0.78, axis: 1.57 },
    { x: width * 0.5, y: height - marginY * 0.68, axis: -1.57 },
  ];
}

function clusterKeyFor(fragment) {
  const primary = fragment.keywords?.[0] || fragment.keyword || fragment.source || "fragment";
  const secondary = fragment.keywords?.[1] || "";
  return `${primary}:${secondary}`;
}

function createLanes(width) {
  return [width * 0.37, width * 0.57, width * 0.78];
}

function chooseLane(fragment, foundation) {
  const preferredLane = hashString(clusterKeyFor(fragment)) % 3;
  const laneCounts = foundation.laneCounts;
  const laneOrder = [preferredLane, (preferredLane + 1) % 3, (preferredLane + 2) % 3];

  return laneOrder.sort((left, right) => laneCounts[left] - laneCounts[right])[0];
}

export function createFoundationState(viewport) {
  const width = viewport.width || 1280;
  const height = viewport.height || 800;
  return {
    width,
    height,
    lanes: createLanes(width),
    laneCounts: [0, 0, 0],
    marginX: width * 0.22,
    marginY: height * 0.1,
    rowHeight: Math.max(52, Math.min(84, height * 0.09)),
    columnWidth: Math.max(260, Math.min(420, width * 0.26)),
    textWidth: Math.max(220, Math.min(360, width * 0.24)),
  };
}

export function placeFoundationFragment(fragment, index, viewport, foundation = createFoundationState(viewport)) {
  const preferredLane = fragment.preferredLane;
  const lane = Number.isInteger(preferredLane) && preferredLane >= 0 && preferredLane <= 2
    ? preferredLane
    : chooseLane(fragment, foundation);
  const row = foundation.laneCounts[lane];
  foundation.laneCounts[lane] += 1;

  const laneX = foundation.lanes[lane];
  const rowY = foundation.marginY + row * foundation.rowHeight;
  const laneBias = lane === 0 ? -1 : lane === 2 ? 1 : 0;
  const depthLayer = lane === 1 ? 1 : lane === 0 ? 0 : 2;
  const sequenceOffset = index * 0.35;
  const widthBias = fragment.weight || 0.5;

  return {
    ...fragment,
    index,
    x: laneX,
    y: rowY,
    targetX: laneX,
    targetY: rowY,
    anchorX: laneX,
    anchorY: rowY,
    clusterCenterX: laneX,
    clusterCenterY: rowY,
    depthLayer,
    lane,
    sequenceIndex: index,
    rowIndex: row,
    orbitRadius: 1.5 + widthBias * 2.5,
    orbitSpeed: 0.004 + ((fragment.signature || 0) % 7) / 10000,
    driftPhase: ((fragment.signature || 0) % 360) / 100,
    clusterKey: clusterKeyFor(fragment),
    clusterMass: fragment.weight || 0.5,
    axisWeight: 0.7 + widthBias * 0.3,
    gravity: 0.45 + widthBias * 0.2,
    foregroundBias: laneBias * 0.12 + sequenceOffset * 0.001,
    layoutWidth: foundation.textWidth,
    layoutLane: lane,
    opacity: depthLayer === 2 ? 0.54 : 0.92,
    memoryOpacity: depthLayer === 2 ? 0.62 : 0.76,
    age: fragment.age || 0,
    stabilizeAt: performance.now() + 1400,
  };
}

export function layoutFragments(fragments, viewport) {
  const foundation = createFoundationState(viewport);
  return fragments.map((fragment, index) => placeFoundationFragment(fragment, index, viewport, foundation));
}
