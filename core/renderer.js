function drawBackground(context, viewport) {
  const { width, height } = viewport;
  context.fillStyle = "#111111";
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.42;
  context.strokeStyle = "rgba(255, 255, 255, 0.03)";
  context.lineWidth = 1;

  const verticalGuides = [width * 0.18, width * 0.5, width * 0.82];
  const horizontalGuides = [height * 0.18, height * 0.5, height * 0.82];

  for (const x of verticalGuides) {
    context.beginPath();
    context.moveTo(x, height * 0.06);
    context.lineTo(x, height * 0.94);
    context.stroke();
  }

  for (const y of horizontalGuides) {
    context.beginPath();
    context.moveTo(width * 0.06, y);
    context.lineTo(width * 0.94, y);
    context.stroke();
  }

  context.save();
  context.globalAlpha = 0.66;
  context.strokeStyle = "rgba(201, 162, 39, 0.08)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width * 0.14, height * 0.1);
  context.lineTo(width * 0.14, height * 0.9);
  context.stroke();
  context.fillStyle = "rgba(201, 162, 39, 0.14)";
  context.fillRect(width * 0.14 - 1, height * 0.1, 2, height * 0.8);
  context.restore();
  context.restore();
}

function drawTheoryFlow(context, viewport, feedLines = []) {
  const { width, height } = viewport;
  const columnWidth = Math.min(420, Math.max(280, width * 0.3));
  const gutter = Math.max(28, width * 0.05);
  const baselineX = gutter;
  const textOffsetX = 112;
  const maxTextWidth = columnWidth - textOffsetX - 32;

  context.save();
  const fade = context.createLinearGradient(0, 0, columnWidth, 0);
  fade.addColorStop(0, "rgba(17, 17, 18, 0.035)");
  fade.addColorStop(0.5, "rgba(17, 17, 18, 0.018)");
  fade.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = fade;
  context.fillRect(0, 0, columnWidth, height);

  context.strokeStyle = "rgba(255, 255, 255, 0.06)";
  context.beginPath();
  context.moveTo(columnWidth + 12, 0);
  context.lineTo(columnWidth + 12, height);
  context.stroke();

  context.textAlign = "left";
  context.textBaseline = "middle";

  for (const line of feedLines) {
    const fadeTop = Math.min(1, Math.max(0, 1 - line.y / (height * 0.42)));
    const fadeBottom = Math.min(1, Math.max(0, (height - line.y) / (height * 0.3)));
    const alpha = Math.min(0.95, Math.max(0, (line.opacity || 0.9) * Math.min(fadeTop, fadeBottom) + 0.06));

    if (alpha <= 0.02) {
      continue;
    }

    const sourceLabel = String(line.source || "").toUpperCase();
    const text = fitText(context, line.text, maxTextWidth);

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = "rgba(238, 238, 238, 0.84)";
    context.font = '500 12px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
    context.fillText(sourceLabel, baselineX, line.y);
    context.fillStyle = "rgba(245, 245, 245, 0.94)";
    context.font = '400 13px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
    context.fillText(text, baselineX + textOffsetX, line.y);
    context.restore();
  }

  context.restore();
}

function drawDebugOverlay(context, viewport, meta = {}) {
  const { width, height } = viewport;

  context.save();
  context.fillStyle = "#111111";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(255, 255, 255, 0.28)";
  context.lineWidth = 1;
  context.strokeRect(12, 12, width - 24, height - 24);

  context.strokeStyle = "rgba(255, 255, 255, 0.12)";
  context.beginPath();
  context.moveTo(24, 24);
  context.lineTo(24, height - 24);
  context.stroke();

  context.fillStyle = "#ffffff";
  context.font = '700 26px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText("THEORIEFLUSS AKTIV", 24, 20);

  context.font = '500 14px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  context.fillText(`viewport ${Math.round(width)} x ${Math.round(height)}`, 24, 56);
  context.fillText(`fragments ${meta.fragmentCount ?? 0} | relations ${meta.relationCount ?? 0} | frame ${meta.frame ?? 0}`, 24, 76);

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const boxW = Math.min(420, Math.max(220, width * 0.24));
  const boxH = 78;

  context.fillStyle = "rgba(255, 255, 255, 0.08)";
  context.fillRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH);
  context.strokeStyle = "rgba(255, 255, 255, 0.75)";
  context.strokeRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH);

  context.fillStyle = "#ffffff";
  context.font = '600 24px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(meta.centerLabel || "FUNDAMENT", centerX, centerY - 2);

  context.font = '500 12px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  context.fillStyle = "rgba(255, 255, 255, 0.75)";
  context.fillText(`x ${Math.round(centerX)} / y ${Math.round(centerY)}`, centerX, centerY + 28);
  context.restore();
}

let cachedNoiseLayer = null;
let cachedNoiseKey = "";

function fitText(context, text, maxWidth) {
  if (!context || !text || !Number.isFinite(maxWidth) || maxWidth <= 0) {
    return String(text || "");
  }

  const value = String(text);
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  const ellipsis = "…";
  let end = value.length;
  while (end > 0 && context.measureText(`${value.slice(0, end)}${ellipsis}`).width > maxWidth) {
    end -= 1;
  }

  return `${value.slice(0, Math.max(0, end))}${ellipsis}`;
}

function createNoiseLayer(width, height) {
  const key = `${width}x${height}`;
  if (cachedNoiseLayer && cachedNoiseKey === key) {
    return cachedNoiseLayer;
  }

  const layer = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : document.createElement("canvas");

  layer.width = width;
  layer.height = height;
  const context = layer.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 255, 255, 0.02)";

  const spacing = 2;
  for (let y = 0; y < height; y += spacing) {
    for (let x = 0; x < width; x += spacing) {
      const value = (x * 12.9898 + y * 78.233 + (x * y) * 0.0003) % 1;
      if (value > 0.84) {
        context.globalAlpha = 0.02 + value * 0.06;
        context.fillRect(x, y, 1, 1);
      }
    }
  }

  cachedNoiseLayer = layer;
  cachedNoiseKey = key;
  return layer;
}

function sortFragmentsForDepth(fragments) {
  return [...fragments].sort((left, right) => {
    const depthLeft = left.depthLayer || 1;
    const depthRight = right.depthLayer || 1;
    if (depthLeft !== depthRight) {
      return depthLeft - depthRight;
    }

    return (left.memoryOpacity || 0) - (right.memoryOpacity || 0);
  });
}

function splitByDepth(fragments) {
  const background = [];
  const middle = [];
  const foreground = [];

  for (const fragment of fragments) {
    if (fragment.phase === "foundation") {
      foreground.push(fragment);
      continue;
    }

    if (fragment.phase === "transformation") {
      middle.push(fragment);
      continue;
    }

    const depth = fragment.depthLayer || 1;
    if (depth === 2) {
      background.push(fragment);
    } else if (depth === 0) {
      foreground.push(fragment);
    } else {
      middle.push(fragment);
    }
  }

  return { background, middle, foreground };
}

function wrapText(context, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [];
  }

  const lines = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    const candidate = `${currentLine} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawRoundedRectPath(context, x, y, width, height, radius) {
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawRelation(context, left, right, relation) {
  const baseAlpha = relation.opacity || (relation.type === "wiki" ? 0.38 : relation.type === "semantic" ? 0.3 : 0.26);
  const alpha = Math.min(0.65, Math.max(0.25, baseAlpha));
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = relation.type === "wiki" ? "rgba(201, 162, 39, 0.92)" : "rgba(255, 255, 255, 0.78)";
  context.lineWidth = Math.max(1.1, relation.score * 0.42);
  context.setLineDash(relation.type === "wiki" ? [4, 10] : relation.type === "drift" ? [2, 8] : []);
  context.beginPath();
  context.moveTo(left.x, left.y);
  context.lineTo(right.x, right.y);
  context.stroke();
  context.restore();

  if (relation.type === "wiki" && relation.progress > 0.55) {
    context.save();
    context.fillStyle = "#c9a227";
    context.globalAlpha = 0.24 * relation.progress;
    context.beginPath();
    context.arc((left.x + right.x) * 0.5, (left.y + right.y) * 0.5, 2.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawFragment(context, fragment, fontSize, accentStrength) {
  const layoutWidth = fragment.layoutWidth || Math.max(200, Math.min(320, 180 + (fragment.weight || 0.5) * 120));
  const paddingX = Math.max(12, fontSize * 0.38);
  const paddingY = Math.max(9, fontSize * 0.28);
  const isPdfPhase = fragment.phase === "pdf";
  const revealProgress = isPdfPhase
    ? Math.min(1, Math.max(0.12, (fragment.age || 0) / 1.55))
    : 1;
  context.save();
  context.translate(fragment.x, fragment.y);
  const role = fragment.role || "peripheral";
  const rotationAmp = role === "central" ? 0.0025 : 0.006;
  context.rotate(Math.sin(fragment.signature * 0.001) * rotationAmp);

  context.font = `${accentStrength > 0.55 ? 700 : 500} ${fontSize}px "Space Grotesk", "Helvetica Neue", "Arial Narrow", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";

  const maxTextWidth = layoutWidth;
  const visibleText = isPdfPhase
    ? fragment.text.slice(0, Math.max(1, Math.floor(fragment.text.length * revealProgress)))
    : fragment.text;
  const lines = wrapText(context, visibleText, maxTextWidth);
  const lineHeight = Math.round(fontSize * 1.18);
  const textBlockWidth = Math.max(...lines.map((line) => context.measureText(line).width), 0);
  const boxWidth = textBlockWidth + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const boxLeft = isPdfPhase ? 0 : -boxWidth / 2;
  const textLeft = isPdfPhase ? paddingX : -boxWidth / 2 + paddingX;
  const opacity = fragment.opacity ?? 1;
  const memoryOpacity = fragment.memoryOpacity ?? 0.72;
  const depthLayer = fragment.depthLayer || 1;
  const depthScale = depthLayer === 0 ? 0.92 : depthLayer === 1 ? 1 : 1.04;
  const shadowOpacity = depthLayer === 2 ? 0.02 : depthLayer === 1 ? 0.04 : 0.06;
  const strokeAlpha = role === "central" ? 0.22 : accentStrength > 0.55 ? 0.16 : 0.06;

  if (isPdfPhase) {
    context.save();
    context.globalAlpha = 0.36;
    context.fillStyle = "rgba(201, 162, 39, 0.11)";
    context.fillRect(boxLeft, -boxHeight / 2, 2, boxHeight);
    context.restore();
  }

  // central anchor subtle axis
  if (role === "central") {
    context.save();
    context.globalAlpha = 0.14;
    context.fillStyle = "rgba(201,162,39,0.06)";
    context.fillRect(-1.5, -boxHeight * 0.9, 3, boxHeight * 1.8);
    context.restore();
  }

  if (fragment.traceX !== undefined && fragment.traceY !== undefined) {
    context.save();
    context.translate(fragment.traceX - fragment.x, fragment.traceY - fragment.y);
    context.globalAlpha = Math.max(0.025, memoryOpacity * 0.16);
    context.fillStyle = "rgba(255, 255, 255, 0.18)";
    context.strokeStyle = "rgba(20, 20, 20, 0.06)";
    context.lineWidth = 1;
    drawRoundedRectPath(context, boxLeft, -boxHeight / 2, boxWidth, boxHeight, 999);
    context.stroke();
    context.fillText(fragment.text, isPdfPhase ? textLeft : 0, 1);
    context.restore();
  }

  context.scale(depthScale, depthScale);
  context.fillStyle = `rgba(26, 24, 22, ${0.70 * opacity})`;
  context.strokeStyle = accentStrength > 0.55 ? "rgba(201, 162, 39, 0.12)" : `rgba(255, 255, 255, ${strokeAlpha})`;
  context.lineWidth = 1;
  context.shadowColor = `rgba(0, 0, 0, ${shadowOpacity + 0.08})`;
  context.shadowBlur = depthLayer === 0 ? 0 : 3;
  drawRoundedRectPath(context, boxLeft, -boxHeight / 2, boxWidth, boxHeight, 999);
  context.fill();
  context.stroke();

  context.fillStyle = `rgba(245, 245, 245, ${0.9 * opacity})`;
  const textTop = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, lineIndex) => {
    context.fillText(line, textLeft, textTop + lineIndex * lineHeight + 1);
  });

  if (isPdfPhase && revealProgress < 1) {
    const currentLine = lines[lines.length - 1] || "";
    const cursorX = textLeft + context.measureText(currentLine).width + 3;
    const cursorY = textTop + (lines.length - 1) * lineHeight + 1;
    context.save();
    context.globalAlpha = 0.72;
    context.fillStyle = "rgba(201, 162, 39, 0.72)";
    context.fillRect(cursorX, cursorY - fontSize * 0.42, 1.5, fontSize * 0.92);
    context.restore();
  }

  if (isPdfPhase) {
    context.save();
    context.globalAlpha = 0.42;
    context.fillStyle = "rgba(201, 162, 39, 0.7)";
    context.font = `500 ${Math.max(8, Math.round(fontSize * 0.54))}px "Space Grotesk", "Helvetica Neue", "Arial Narrow", sans-serif`;
    context.textAlign = "left";
    context.fillText(fragment.source || "ARCHIV", textLeft, -boxHeight / 2 + paddingY * 0.72);
    context.restore();
  }

  if (fragment.keywords[0] && accentStrength > 0.55) {
    context.fillStyle = "rgba(201, 162, 39, 0.42)";
    context.beginPath();
    context.arc(boxWidth / 2 - 8, -boxHeight / 2 + 8, 2.2, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export function renderScene(context, viewport, fragments, relations, feedLines = []) {
  const safeViewport = viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height)
    ? viewport
    : { width: 0, height: 0 };
  const safeFragments = Array.isArray(fragments) ? fragments : [];
  const safeRelations = Array.isArray(relations) ? relations : [];
  const safeFeedLines = Array.isArray(feedLines) ? feedLines : [];
  const { width, height } = safeViewport;

  if (!context || width <= 0 || height <= 0) {
    return;
  }

  context.clearRect(0, 0, width, height);
  drawBackground(context, safeViewport);

  const noiseLayer = createNoiseLayer(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  if (noiseLayer) {
    context.save();
    context.globalAlpha = 0.06;
    context.drawImage(noiseLayer, 0, 0, width, height);
    context.restore();
  }

  drawTheoryFlow(context, safeViewport, safeFeedLines);

  const fragmentByIndex = safeFragments;
  const depthSortedFragments = sortFragmentsForDepth(safeFragments);
  const { background, middle, foreground } = splitByDepth(depthSortedFragments);

  for (const fragment of background) {
    const base = Math.max(11, Math.min(21, 9.8 + fragment.weight * 7.6 + (fragment.clusterMass || 0) * 0.04));
    const fontSize = Math.round(base * (fragment.sizeScale || 1));
    drawFragment(context, fragment, fontSize, fragment.keywords.length / 4);
  }

  for (const fragment of middle) {
    const base = Math.max(12, Math.min(23, 10.2 + fragment.weight * 8.8 + (fragment.clusterMass || 0) * 0.06));
    let fontSize = Math.round(base * (fragment.sizeScale || 1));
    if (fragment.phase === "pdf") fontSize = Math.round(fontSize * 0.86);
    const accentStrength = fragment.keywords.length / 4;
    drawFragment(context, fragment, fontSize, accentStrength);
  }

  for (const fragment of foreground) {
    const base = Math.max(12, Math.min(24, 10.6 + fragment.weight * 9.2 + (fragment.clusterMass || 0) * 0.07));
    const fontSize = Math.round(base * (fragment.sizeScale || 1));
    const accentStrength = fragment.keywords.length / 4;
    drawFragment(context, fragment, fontSize, accentStrength);
  }

  for (const relation of safeRelations) {
    const left = fragmentByIndex[relation.leftIndex];
    const right = fragmentByIndex[relation.rightIndex];
    if (left && right && relation.progress > 0.05) {
      drawRelation(context, left, right, relation);
    }
  }

  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 1;
  context.strokeRect(16, 16, width - 32, height - 32);
  context.fillStyle = "rgba(201, 162, 39, 0.12)";
  context.fillRect(width * 0.13, 22, 1, height - 44);
  context.fillStyle = "rgba(245, 245, 245, 0.7)";
  context.font = '500 12px "Space Grotesk", "Helvetica Neue", "Arial Narrow", sans-serif';
  context.textAlign = "left";
  context.fillText("THEORIEFLUSS / ARCHITEKTONISCHE SETZUNG", 28, 34);
  context.restore();
}

export function renderDebugScene(context, viewport, meta = {}) {
  drawDebugOverlay(context, viewport, meta);
}

export function renderDiagnosticsOverlay(context, viewport, meta = {}) {
  const { width, height } = viewport;
  const lines = Array.isArray(meta.theoryLines) ? meta.theoryLines.slice(0, 10) : [];

  context.save();
  const panelWidth = Math.min(560, Math.max(320, width * 0.38));
  const panelHeight = Math.min(height - 28, Math.max(220, 150 + lines.length * 18));
  context.fillStyle = "rgba(0, 0, 0, 0.24)";
  context.fillRect(14, 14, panelWidth, panelHeight);
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.strokeRect(14, 14, panelWidth, panelHeight);

  context.fillStyle = "#ffffff";
  context.font = '700 20px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText("THEORIEFLUSS AKTIV", 26, 22);

  context.font = '500 13px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.fillText(`phase: ${meta.phase || "?"}`, 26, 50);
  context.fillText(`queue pdf ${meta.queuePdf ?? 0} | extraction ${meta.queueExtraction ?? 0} | foundation ${meta.queueFoundation ?? 0}`, 26, 68);
  context.fillText(`fragments ${meta.fragmentCount ?? 0} | foundation objects ${meta.foundationCount ?? 0} | active ${meta.activeObjects ?? 0}`, 26, 86);
  context.fillText(`viewport ${Math.round(width)} x ${Math.round(height)} | dpr ${meta.dpr ?? 1}`, 26, 104);

  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  context.font = '500 12px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  let y = 130;
  for (const line of lines) {
    context.fillText(line, 26, y);
    y += 16;
  }

  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.font = '600 14px "Space Grotesk", "Helvetica Neue", Arial, sans-serif';
  context.fillText(`center: ${meta.centerLabel || "FUNDAMENT"}`, 26, Math.min(height - 28, y + 10));
  context.restore();
}
