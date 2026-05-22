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

const foundationWords = [
  "RAUM",
  "HANDLUNG",
  "PRAXIS",
  "GESELLSCHAFT",
  "BEWEGUNG"
];

let visibleFoundation = [];
let currentFoundation = 0;

// Neue Zeile alle 700ms
const interval = setInterval(() => {

  if (currentLine < lines.length) {

    visibleLines.push({
      text: lines[currentLine],
      x: 60,
      y: 80 + currentLine * 40
    });

    currentLine++;

  } else {

    clearInterval(interval);
    
    startFoundation();

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

  visibleFoundation.forEach(word => {

  // Langsame Bewegung zur Zielposition
  word.x += (word.targetX - word.x) * 0.01;
  word.y += (word.targetY - word.y) * 0.01;

  // Schrift
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 42px sans-serif";

  // Hintergrundfläche für Ruhe
  const padding = 20;

  const metrics = ctx.measureText(word.text);

  const boxWidth = metrics.width + padding * 2;
  const boxHeight = 60;

  // Schwarze Fläche hinter Begriff
  ctx.fillStyle = "rgba(0,0,0,0.85)";

  ctx.fillRect(
    word.x - padding,
    word.y - 45,
    boxWidth,
    boxHeight
  );

  // Schrift
  ctx.fillStyle = "white";

  ctx.fillText(
    word.text,
    word.x,
    word.y
  );

});

  requestAnimationFrame(draw);
}

draw();

function startFoundation() {

  const foundationInterval = setInterval(() => {

    if (currentFoundation < foundationWords.length) {

      // Größere architektonische Struktur
      const columns = 2;

      const row = Math.floor(currentFoundation / columns);
      const column = currentFoundation % columns;

      // Zentrum des Raumes
      const centerX = canvas.width / 2;
      const startY = 240;

      // Große Abstände für Lesbarkeit
      const horizontalSpacing = 320;
      const verticalSpacing = 140;

      // Fundamentposition
      const targetX =
        centerX +
        (column - 0.5) * horizontalSpacing;

      const targetY =
        startY +
        row * verticalSpacing;

      visibleFoundation.push({

        text: foundationWords[currentFoundation],

        // Startposition leicht außen
        x: targetX + (Math.random() * 40 - 20),
        y: targetY + 80,

        // Zielposition
        targetX,
        targetY,

        // Sehr langsame Bewegung
        velocityX: 0,
        velocityY: 0

      });

      currentFoundation++;

    } else {

      clearInterval(foundationInterval);

    }

  }, 1600);

}
