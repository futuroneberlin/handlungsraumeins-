const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Theoriezeilen
const lines = [
  "Soziale Plastik beschreibt Gesellschaft als Formprozess.",
  "Raum entsteht durch Handlung.",
  "Kunst ist menschliche Praxis.",
  "Bewegung erzeugt Relation.",
  "Architektur entsteht aus Verdichtung.",
  "Leere ist Teil der Konstruktion.",
  "Der Raum bleibt veränderbar.",
  "Gesellschaft wird als Prozess verstanden."
];

// Sichtbare Zeilen
let visibleLines = [];

// Welche Zeile gerade erscheint
let currentLine = 0;

// Neue Zeile alle 700ms
setInterval(() => {

  if (currentLine < lines.length) {

    visibleLines.push({
      text: lines[currentLine],
      x: 60,
      y: 80 + currentLine * 40
    });

    currentLine++;
  }

}, 700);

function draw() {

  // Hintergrund
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Titel
  ctx.fillStyle = "white";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("THEORIEFLUSS", 60, 40);

  // Theoriezeilen
  ctx.font = "20px sans-serif";

  visibleLines.forEach(line => {

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(line.text, line.x, line.y);

  });

  requestAnimationFrame(draw);
}

draw();
