const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const words = [
  "SOZIALE PLASTIK",
  "RAUM",
  "HANDLUNG",
  "PRAXIS",
  "GESELLSCHAFT"
];

function draw() {

  // Hintergrund
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Schrift
  ctx.fillStyle = "white";
  ctx.font = "32px sans-serif";

  // Wörter zeichnen
  words.forEach((word, index) => {

    const x = 100;
    const y = 120 + index * 60;

    ctx.fillText(word, x, y);

  });

  requestAnimationFrame(draw);
}

draw();
