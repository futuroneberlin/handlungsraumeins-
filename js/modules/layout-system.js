function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeTarget(index, total, width, height) {
  const columns = Math.max(3, Math.round(Math.sqrt(total) * 1.5));
  const rows = Math.max(3, Math.ceil(total / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);

  const horizontalBand = width * 0.14;
  const verticalBand = height * 0.18;
  const usableWidth = width - horizontalBand * 2;
  const usableHeight = height - verticalBand * 2;

  const gapX = columns > 1 ? usableWidth / (columns - 1) : usableWidth;
  const gapY = rows > 1 ? usableHeight / (rows - 1) : usableHeight;

  const offsetX = ((row % 2) - 0.5) * gapX * 0.22;
  const offsetY = ((column % 3) - 1) * gapY * 0.07;

  return {
    x: clamp(horizontalBand + column * gapX + offsetX, width * 0.08, width * 0.92),
    y: clamp(verticalBand + row * gapY + offsetY, height * 0.1, height * 0.88),
  };
}

export function createSpatialLayoutSystem() {
  return {
    createNodes(fragments, width, height) {
      return fragments.map((fragment, index) => {
        const target = computeTarget(index, fragments.length, width, height);
        return {
          ...fragment,
          x: target.x,
          y: target.y,
          targetX: target.x,
          targetY: target.y,
          driftPhase: (index + 1) * 0.57,
          blockWidth: 0,
          blockHeight: 0,
        };
      });
    },

    reorganize(nodes, width, height) {
      nodes.forEach((node, index) => {
        const target = computeTarget(
          (index * 3 + Math.floor(index / 2)) % nodes.length,
          nodes.length,
          width,
          height
        );
        node.targetX = target.x;
        node.targetY = target.y;
      });
    },
  };
}
