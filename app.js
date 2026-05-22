const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// TEST DATEN (wichtig!)
const testWords = [
  "SOZIALE PLASTIK",
  "RAUM",
  "HANDLUNG",
  "PRAXIS",
  "BEUYS"
];

function draw() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "30px sans-serif";

  testWords.forEach((word, i) => {
    ctx.fillText(word, 100, 100 + i * 50);
  });

  requestAnimationFrame(draw);
}

draw();