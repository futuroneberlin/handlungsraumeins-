import { createElement, useEffect, useMemo, useRef } from "react";
import { createCanvasStage } from "../../core/canvas.js";
import { renderScene } from "../../core/renderer.js";
import { advanceForceSimulation } from "../graph/forceSimulation.js";
import { refreshSemanticTopology, updateSemanticLayers } from "../graph/semanticResolver.js";
import { scheduleGraphStateSave } from "../graph/graphState.js";

function pickNodeAt(state, canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let bestNode = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of state.nodes || []) {
    const radius = Math.max(16, (node.layoutWidth || 220) * 0.22);
    const distance = Math.hypot(x - node.x, y - node.y);
    if (distance <= radius && distance < bestDistance) {
      bestNode = node;
      bestDistance = distance;
    }
  }

  return bestNode;
}

export function GraphCanvas({ store, onNodeSelect }) {
  const canvasRef = useRef(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  const runtime = useMemo(() => ({
    refreshTopology() {
      const state = store.getState();
      const next = refreshSemanticTopology(state, performance.now());
      store.update((draft) => {
        draft.edges = next.edges;
        draft.categories = next.categories;
      });
      scheduleGraphStateSave(store.getState());
    },
  }), [store]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const stage = createCanvasStage(canvas);
    const context = stage.context;
    let active = true;
    let frameId = 0;

    const resize = () => {
      stage.resize();
      runtime.refreshTopology();
      store.update((draft) => {
        draft.viewport = stage.getViewport();
      });
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const handleClick = (event) => {
      const state = store.getState();
      const node = pickNodeAt(state, canvas, event);
      if (node) {
        onNodeSelectRef.current?.(node);
      }
    };

    canvas.addEventListener("click", handleClick);

    const tick = (now) => {
      if (!active) {
        return;
      }

      const state = store.getState();
      const delta = Math.min(48, now - (state.lastFrameAt || now) || 16.67);
      store.update((draft) => {
        draft.lastFrameAt = now;
      });
      advanceForceSimulation(state, now, delta);
      updateSemanticLayers(state, now);
      renderScene(context, stage.getViewport(), state);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", handleClick);
    };
  }, [runtime, store]);

  return createElement("canvas", { id: "scene", ref: canvasRef });
}
