import { createCanvasScene } from "./js/modules/canvas-scene.js";
import { fragmentTextBlocks } from "./js/modules/fragmenter.js";
import { createSpatialLayoutSystem } from "./js/modules/layout-system.js";
import { createMotionSystem } from "./js/modules/motion-system.js";
import { createPdfLoader } from "./js/modules/pdf-loader.js";
import { createTypographySystem } from "./js/modules/typography-system.js";
import { createWikipediaService } from "./js/modules/wikipedia.js";

const canvas = document.getElementById("scene");
const statusText = document.getElementById("status-text");
const relationText = document.getElementById("relation-text");
const focusText = document.getElementById("focus-text");
const reloadButton = document.getElementById("reload-button");
const uploadInput = document.getElementById("upload-input");

const pdfLoader = createPdfLoader({
  manifestUrl: "./pdf/manifest.json",
  statusCallback: updateStatus,
});

const scene = createCanvasScene({
  canvas,
  layoutSystem: createSpatialLayoutSystem(),
  motionSystem: createMotionSystem(),
  typographySystem: createTypographySystem(),
  wikipediaService: createWikipediaService(),
  updateStatus,
  updateRelation: (text) => {
    relationText.textContent = text;
  },
  updateFocus: (text) => {
    focusText.textContent = text;
  },
});

async function rebuildSpace(blocks) {
  const fragments = fragmentTextBlocks(blocks);
  await scene.setFragments(fragments);

  const fragmentCount = fragments.length;
  updateStatus(
    `${fragmentCount} Fragmente im Raum aktiv — Quellen: ${[...new Set(blocks.map((block) => block.source))].join(", ")}`
  );
}

async function boot() {
  try {
    const blocks = await pdfLoader.loadRepositoryPdfs();
    await rebuildSpace(blocks);
  } catch (error) {
    console.error(error);
    updateStatus("PDF-Ladung fehlgeschlagen — lokaler Fallback-Text wird verwendet.");
    await rebuildSpace(pdfLoader.getFallbackBlocks());
  }
}

function updateStatus(message) {
  statusText.textContent = message;
}

reloadButton.addEventListener("click", async () => {
  updateStatus("Raum wird aus dem Verzeichnis /pdf neu aufgebaut …");
  await boot();
});

uploadInput.addEventListener("change", async (event) => {
  const files = [...event.target.files];

  if (!files.length) {
    return;
  }

  updateStatus(`${files.length} lokale PDF-Datei(en) werden integriert …`);
  const blocks = await pdfLoader.loadLocalFiles(files);
  await rebuildSpace(blocks);
  uploadInput.value = "";
});

window.addEventListener("resize", () => {
  scene.resize();
});

boot();
