export function createCanvasStage(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError("createCanvasStage erwartet ein Canvas-Element.");
  }

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Canvas-2D-Kontext nicht verfügbar.");
  }

  const viewport = {
    width: 0,
    height: 0,
    dpr: 1,
  };

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    viewport.width = width;
    viewport.height = height;
    viewport.dpr = dpr;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clear(fillStyle = "#f4efe6") {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = fillStyle;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }

  function getViewport() {
    return { ...viewport };
  }

  resize();

  return {
    canvas,
    context,
    viewport,
    resize,
    clear,
    getViewport,
  };
}
