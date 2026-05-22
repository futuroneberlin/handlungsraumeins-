const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


// --------------------------------------------------
// INTERNETDATEN
// --------------------------------------------------

const searchTerms = [
  "Soziale Plastik",
  "socialsculpture",
  "space",
  "Kunst",
  "art",
  "artasexperience",
  
];


// --------------------------------------------------
// THEORIEFLUSS
// --------------------------------------------------

let lines = [];

let visibleLines = [];

let currentLine = 0;


// --------------------------------------------------
// FUNDAMENT
// --------------------------------------------------

let foundationWords = [];

let visibleFoundation = [];

let currentFoundation = 0;


// --------------------------------------------------
// WIKIPEDIA LADEN
// --------------------------------------------------

async function loadTheoryTexts() {

  for (const term of searchTerms) {

    try {

      const response = await fetch(
        `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`
      );

      const data = await response.json();

      if (data.extract) {

        const sentences =
          data.extract.split(". ");

        sentences.forEach(sentence => {

          if (sentence.length > 40) {

            lines.push(sentence);

          }

        });

      }

    } catch (error) {

      console.log(
        "Wikipedia Fehler:",
        error
      );

    }

  }

  extractFoundationWords();

  startTheoryFlow();

}


// --------------------------------------------------
// BEGRIFFE EXTRAHIEREN
// --------------------------------------------------

function extractFoundationWords() {

  const importantWords = [];

  lines.forEach(line => {

    const words = line.split(" ");

    words.forEach(word => {

      const clean =
        word.replace(/[.,!?()]/g, "");

      if (
        clean.length > 7 &&
        clean[0] === clean[0].toUpperCase()
      ) {

        importantWords.push(
          clean.toUpperCase()
        );

      }

    });

  });

  foundationWords =
    [...new Set(importantWords)]
    .slice(0, 10);

}


// --------------------------------------------------
// THEORIEFLUSS START
// --------------------------------------------------

function startTheoryFlow() {

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

  }, 500);

}


// --------------------------------------------------
// FUNDAMENT AUFBAU
// --------------------------------------------------

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


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function draw() {

  // Hintergrund
  ctx.fillStyle = "black";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  // --------------------------------------------------
  // TITEL
  // --------------------------------------------------

  ctx.fillStyle = "white";

  ctx.font = "bold 28px sans-serif";

  ctx.fillText(
    "THEORIEFLUSS",
    60,
    50
  );


  // --------------------------------------------------
  // THEORIEZEILEN
  // --------------------------------------------------

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


  // --------------------------------------------------
  // RELATIONEN
  // --------------------------------------------------

  for (let i = 0; i < visibleFoundation.length; i++) {

    for (let j = i + 1; j < visibleFoundation.length; j++) {

      const a = visibleFoundation[i];

      const b = visibleFoundation[j];

      const distance =
        Math.hypot(
          a.x - b.x,
          a.y - b.y
        );

      if (distance < 420) {

        ctx.strokeStyle =
          "rgba(255,255,255,0.08)";

        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.moveTo(
          a.x + 130,
          a.y + 45
        );

        ctx.lineTo(
          b.x + 130,
          b.y + 45
        );

        ctx.stroke();

      }

    }

  }


  // --------------------------------------------------
  // FUNDAMENT
  // --------------------------------------------------

  visibleFoundation.forEach(word => {

    // Langsame Bewegung
    word.x +=
      (word.targetX - word.x) * 0.008;

    word.y +=
      (word.targetY - word.y) * 0.008;


    // Fundamentgröße
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


// --------------------------------------------------
// RESIZE
// --------------------------------------------------

window.addEventListener("resize", () => {

  canvas.width = window.innerWidth;

  canvas.height = window.innerHeight;

});


// --------------------------------------------------
// START
// --------------------------------------------------

draw();

loadTheoryTexts();

