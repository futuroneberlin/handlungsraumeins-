const PDFJS_MODULE_URL = new URL("../vendor/pdf.min.mjs", import.meta.url).href;
const PDFJS_WORKER_URL = new URL(
  "../vendor/pdf.worker.min.mjs",
  import.meta.url
).href;

const FALLBACK_BLOCKS = [
  {
    source: "Fallback",
    text: "Handlungsraum denkt Text als räumliche Praxis. Erfahrung bleibt nicht privat, sondern ordnet sich im Verhältnis zu anderen Körpern und Stimmen.",
  },
  {
    source: "Fallback",
    text: "Die soziale Plastik ist hier keine Geste des Spektakels. Sie ist eine langsame Konstruktion aus Distanz, Wiederholung, Drift und Entscheidung.",
  },
  {
    source: "Fallback",
    text: "Fragment, Begriff und Linie bilden eine architektonische Typografie. Weißraum hält den Raum offen, damit Relation als Handlung lesbar bleibt.",
  },
];

let pdfjsPromise;

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_MODULE_URL).then((module) => {
      module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return module;
    });
  }

  return pdfjsPromise;
}

async function extractBlocksFromDocument({ data, url, sourceLabel }) {
  const pdfjsLib = await getPdfJs();
  const documentTask = data
    ? pdfjsLib.getDocument({ data })
    : pdfjsLib.getDocument(url);
  const pdf = await documentTask.promise;
  const blocks = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    const normalizedText = pageText.replace(/\s+/g, " ").trim();

    if (normalizedText) {
      blocks.push({
        source: sourceLabel,
        page: pageNumber,
        text: normalizedText,
      });
    }
  }

  return blocks;
}

export function createPdfLoader({ manifestUrl, statusCallback }) {
  return {
    async loadRepositoryPdfs() {
      statusCallback?.("Lese PDF-Manifest …");

      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Manifest konnte nicht geladen werden: ${response.status}`);
      }

      const manifest = await response.json();
      const files = Array.isArray(manifest.files) ? manifest.files : [];

      if (!files.length) {
        statusCallback?.("Keine PDFs im Manifest gefunden — Fallback-Material wird verwendet.");
        return this.getFallbackBlocks();
      }

      statusCallback?.(`${files.length} PDF-Datei(en) werden extrahiert …`);
      const extracted = await Promise.all(
        files.map((file) =>
          extractBlocksFromDocument({
            url: `./pdf/${file}`,
            sourceLabel: file,
          })
        )
      );

      const blocks = extracted.flat();
      return blocks.length ? blocks : this.getFallbackBlocks();
    },

    async loadLocalFiles(files) {
      const extracted = await Promise.all(
        files.map(async (file) =>
          extractBlocksFromDocument({
            data: await file.arrayBuffer(),
            sourceLabel: file.name,
          })
        )
      );

      const blocks = extracted.flat();
      return blocks.length ? blocks : this.getFallbackBlocks();
    },

    getFallbackBlocks() {
      return structuredClone(FALLBACK_BLOCKS);
    },
  };
}
