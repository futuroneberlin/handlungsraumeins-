const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


// -----------------------------
// THEORIEFLUSS
// -----------------------------

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

let visibleLines = [];
let currentLine = 0;


// -----------------------------
// FUNDAMENT
// -----------------------------

const foundationWords = [
  "RAUM",
  "HANDLUNG",
  "PRAXIS",
  "GESELLSCHAFT",
  "BEWEGUNG"
];

let visibleFoundation = [];
let currentFoundation = 0;


// -----------------------------
// THEORIEFLUSS START
// -----------------------------

const interval = setInterval(() => {

  if (currentLine < lines.length) {

    visibleLines.push({

      text: lines[currentLine],
      x: 60,
      y: 90 + currentLine * 42

    });

    currentLine++;

  } else {

    clearInterval(interval);

    startFoundation();

  }

}, 700);


// -----------------------------
// FUNDAMENT AUFBAU
// -----------------------------

function startFoundation() {

  const foundationInterval = setInterval(() => {

    if (currentFoundation < foundationWords.length) {

      const columns = 2;

      const row =
        Math.floor(currentFoundation / columns);

      const column =
        currentFoundation % columns;

      const centerX =
        canvas.width / 2 - 220;

      const startY = 240;

      const horizontalSpacing = 340;
      const verticalSpacing = 160;

      const targetX =
        centerX +
        column * horizontalSpacing;

      const targetY =
        startY +
        row * verticalSpacing;

      visibleFoundation.push({

        text: foundationWords[currentFoundation],

        x: targetX + (Math.random() * 120 - 60),

        y: targetY + 140,

        targetX,
        targetY

      });

      currentFoundation++;

    } else {

      clearInterval(foundationInterval);

    }

  }, 1600);

}


// -----------------------------
// RENDER
// -----------------------------

function draw() {

  // Hintergrund
  ctx.fillStyle = "black";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  // -----------------------------
  // TITEL
  // -----------------------------

  ctx.fillStyle = "white";
  ctx.font = "bold 28px sans-serif";

  ctx.fillText(
    "THEORIEFLUSS",
    60,
    50
  );


  // -----------------------------
  // THEORIEZEILEN
  // -----------------------------

  ctx.font = "20px sans-serif";

  visibleLines.forEach(line => {

    ctx.fillStyle =
      "rgba(255,255,255,0.9)";

    ctx.fillText(
      line.text,
      line.x,
      line.y
    );

  });


  // -----------------------------
  // FUNDAMENT
  // -----------------------------

  visibleFoundation.forEach(word => {

    // Langsame Bewegung
    word.x +=
      (word.targetX - word.x) * 0.008;

    word.y +=
      (word.targetY - word.y) * 0.008;


    // Blockgröße
    const blockWidth = 260;
    const blockHeight = 90;


    // Fundamentblock
    ctx.fillStyle =
      "rgba(20,20,20,0.96)";

    ctx.fillRect(
      word.x,
      word.y,
      blockWidth,
      blockHeight
    );


    // Kontur
    ctx.strokeStyle =
      "rgba(255,255,255,0.08)";

    ctx.lineWidth = 1;

    ctx.strokeRect(
      word.x,
      word.y,
      blockWidth,
      blockHeight
    );


    // Text
    ctx.fillStyle = "white";

    ctx.font =
      "bold 30px sans-serif";

    const textWidth =
      ctx.measureText(word.text).width;

    ctx.fillText(
      word.text,
      word.x +
      (blockWidth / 2) -
      (textWidth / 2),

      word.y + 54
    );

  });


  requestAnimationFrame(draw);

}


// -----------------------------
// START
// -----------------------------

draw();
