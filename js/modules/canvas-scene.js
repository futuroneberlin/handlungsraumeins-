function resizeCanvasToDisplaySize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.floor(rect.width * ratio);
  const height = Math.floor(rect.height * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return {
    width: rect.width,
    height: rect.height,
    ratio,
  };
}

function drawFrame(context, width, height) {
  context.save();
  context.strokeStyle = "rgba(21, 21, 21, 0.08)";
  context.lineWidth = 1;
  context.strokeRect(width * 0.035, height * 0.06, width * 0.93, height * 0.88);
  context.restore();
}

function drawRelations(context, nodesById, relations) {
  context.save();
  relations.forEach((relation) => {
    const participants = relation.fragmentIds
      .map((id) => nodesById.get(id))
      .filter(Boolean);

    if (participants.length < 2) {
      return;
    }

    context.strokeStyle = "rgba(215, 184, 0, 0.3)";
    context.lineWidth = 1;

    for (let index = 0; index < participants.length - 1; index += 1) {
      const current = participants[index];
      const next = participants[index + 1];
      context.beginPath();
      context.moveTo(current.x, current.y);
      context.lineTo(next.x, next.y);
      context.stroke();
    }

    participants.forEach((node) => {
      context.fillStyle = "rgba(215, 184, 0, 0.9)";
      context.beginPath();
      context.arc(node.x - 12, node.y - 12, 3.5, 0, Math.PI * 2);
      context.fill();
    });
  });
  context.restore();
}

function drawNodes(context, nodes, typographySystem, hoveredNode) {
  context.save();

  nodes.forEach((node) => {
    const metrics = typographySystem.measure(context, node);
    node.blockWidth = metrics.width;
    node.blockHeight = metrics.height;

    context.font = `${metrics.fontSize}px ${metrics.fontFamily}`;
    context.fillStyle =
      hoveredNode?.id === node.id ? "rgba(21, 21, 21, 1)" : metrics.color;
    context.textBaseline = "top";

    metrics.lines.forEach((line, lineIndex) => {
      context.fillText(
        line,
        node.x,
        node.y + lineIndex * metrics.lineHeight
      );
    });
  });

  context.restore();
}

function findHoveredNode(nodes, pointer) {
  if (!pointer.active) {
    return null;
  }

  return (
    nodes.find(
      (node) =>
        pointer.x >= node.x - 8 &&
        pointer.x <= node.x + node.blockWidth + 8 &&
        pointer.y >= node.y - 8 &&
        pointer.y <= node.y + node.blockHeight + 8
    ) ?? null
  );
}

export function createCanvasScene({
  canvas,
  layoutSystem,
  motionSystem,
  typographySystem,
  wikipediaService,
  updateStatus,
  updateRelation,
  updateFocus,
}) {
  const context = canvas.getContext("2d");
  let nodes = [];
  let relations = [];
  let viewport = resizeCanvasToDisplaySize(canvas);
  let hoveredNode = null;
  const pointer = { x: 0, y: 0, active: false };

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  });

  canvas.addEventListener("mouseleave", () => {
    pointer.active = false;
    hoveredNode = null;
    updateFocus(
      "Bewege den Cursor durch den Raum oder warte auf die langsame Reorganisation."
    );
  });

  async function buildRelations() {
    updateStatus("Begriffsrelationen und Wikipedia-Kontexte werden aufgebaut …");
    relations = await wikipediaService.resolveRelations(nodes);

    if (relations.length) {
      const strongest = relations[0];
      updateRelation(
        `${strongest.wiki.title}: ${strongest.fragmentIds.length} Fragmente teilen den Begriff „${strongest.term}“.`
      );
      updateFocus(strongest.wiki.extract);
    } else {
      updateRelation("Keine gemeinsamen Begriffe gefunden — der Raum bleibt offen.");
    }
  }

  function render(time) {
    viewport = resizeCanvasToDisplaySize(canvas);
    context.setTransform(viewport.ratio, 0, 0, viewport.ratio, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);

    motionSystem.update(nodes, time, viewport.width, viewport.height, () =>
      layoutSystem.reorganize(nodes, viewport.width, viewport.height)
    );

    hoveredNode = findHoveredNode(nodes, pointer);

    if (hoveredNode) {
      const relation = relations.find((item) =>
        item.fragmentIds.includes(hoveredNode.id)
      );

      updateFocus(
        relation?.wiki?.extract ??
          `${hoveredNode.text} — Quelle: ${hoveredNode.source}${
            hoveredNode.page ? `, Seite ${hoveredNode.page}` : ""
          }.`
      );
    }

    drawFrame(context, viewport.width, viewport.height);
    drawRelations(context, new Map(nodes.map((node) => [node.id, node])), relations);
    drawNodes(context, nodes, typographySystem, hoveredNode);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  return {
    async setFragments(fragments) {
      viewport = resizeCanvasToDisplaySize(canvas);
      nodes = layoutSystem.createNodes(fragments, viewport.width, viewport.height);
      await buildRelations();
    },

    resize() {
      viewport = resizeCanvasToDisplaySize(canvas);
      layoutSystem.reorganize(nodes, viewport.width, viewport.height);
    },
  };
}
