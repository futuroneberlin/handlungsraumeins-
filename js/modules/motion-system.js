export function createMotionSystem() {
  let lastReorganization = 0;

  return {
    update(nodes, time, width, height, reorganize) {
      if (time - lastReorganization > 14000) {
        reorganize();
        lastReorganization = time;
      }

      nodes.forEach((node, index) => {
        const driftX = Math.sin(time * 0.00008 + node.driftPhase) * 14;
        const driftY = Math.cos(time * 0.00006 + index * 0.32) * 12;

        node.x += (node.targetX + driftX - node.x) * 0.012;
        node.y += (node.targetY + driftY - node.y) * 0.012;

        node.x = Math.max(width * 0.06, Math.min(width * 0.94, node.x));
        node.y = Math.max(height * 0.08, Math.min(height * 0.9, node.y));
      });
    },
  };
}
