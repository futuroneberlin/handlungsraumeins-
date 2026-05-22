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

  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = "bold 34px sans-serif";

  ctx.fillText(word.text, word.x, word.y);

});

  requestAnimationFrame(draw);
}

draw();

function startFoundation() {

  const foundationInterval = setInterval(() => {

    if (currentFoundation < foundationWords.length) {

      visibleFoundation.push({

        text: foundationWords[currentFoundation],

        x: canvas.width / 2 - 100,

        y: 200 + currentFoundation * 60

      });

      currentFoundation++;

    } else {

      clearInterval(foundationInterval);

    }

  }, 1200);

}
