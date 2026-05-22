const DEFAULT_THEORIES = [
  { source: "Beuys", text: "Soziale Plastik: Kunst als gesellschaftliche Handlung. Joseph Beuys formuliert Kunst als partizipative Praxis." },
  { source: "Dewey", text: "John Dewey beschreibt Erfahrung als zentrales Moment von Kunst und Bildung; Praxis als lernender Prozess." },
  { source: "Bertram", text: "Georg W. Bertram diskutiert Raum, Form und die sozialen Aspekte architektonischer Praxis." },
  { source: "Bildhauerei", text: "Bildhauerei und Formprozesse erzeugen räumliche Spannung und Schichtung." },
  { source: "Architektur", text: "Architektur als soziale Struktur; Aufbau, Verdichtung und Fundament als räumliche Prinzipien." },
  { source: "Praxis", text: "Handlung, Prozess und Partizipation bilden die Grundlage praktischer Kunsttheorie." },
];

export async function loadTheoryCorpus() {
  // Placeholder: in future this could fetch live indices or APIs.
  // For now return a curated set of theory fragments.
  const corpus = DEFAULT_THEORIES.map((t, i) => ({ source: t.source, text: t.text, order: i }));
  console.log("theoryLoader corpus", corpus.length, corpus.map((entry) => entry.text));
  return corpus;
}

export function flattenLines(corpus) {
  const lines = [];
  for (const entry of corpus) {
    const text = String(entry.text || "");
    const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      lines.push({ source: entry.source, text: part });
    }
  }
  console.log("theoryLoader flattened lines", lines.length, lines.slice(0, 10).map((entry) => entry.text));
  return lines;
}
