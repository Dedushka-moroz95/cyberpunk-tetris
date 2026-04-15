const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const nextCanvas = document.getElementById("nextPiece");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");

const restartBtn = document.getElementById("restartBtn");
const pauseBtn = document.getElementById("pauseBtn");
const clearBestBtn = document.getElementById("clearBestBtn");

const COLS = 10;
const ROWS = 20;
const BLOCK = canvas.width / COLS;

const COLORS = {
  I: "#00f6ff",
  O: "#ffe600",
  T: "#c084fc",
  S: "#00ffa3",
  Z: "#ff4d6d",
  J: "#4ea8ff",
  L: "#ff9f1c",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const SCORE_TABLE = [0, 100, 300, 500, 800];

let board = [];
let player = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let best = Number(localStorage.getItem("cyberpunk-tetris-best") || 0);
let lastTime = 0;
let dropCounter = 0;
let isPaused = false;
let isGameOver = false;
let animationId = null;
let clearingRows = [];
let clearAnimationStart = 0;
let isClearing = false;
const CLEAR_ANIMATION_DURATION = 180;

bestEl.textContent = best;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];

  return {
    type,
    matrix: SHAPES[type].map((row) => [...row]),
    pos: {
      x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
      y: 0,
    },
  };
}

function updateStatus(text, state) {
  statusEl.textContent = text;
  statusEl.className = "status " + state;
}

function updateUI() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  bestEl.textContent = best;
  pauseBtn.textContent = isPaused ? "Продолжить" : "Пауза";
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  lastTime = 0;
  dropCounter = 0;
  isPaused = false;
  isGameOver = false;

  clearingRows = [];
  clearAnimationStart = 0;
  isClearing = false;

  nextPiece = randomPiece();
  spawnPiece();

  updateStatus("В ИГРЕ", "playing");
  updateUI();

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(update);
}

function drawCell(x, y, color, alpha = 1) {
  const px = x * BLOCK;
  const py = y * BLOCK;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.shadowBlur = 16;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, BLOCK, BLOCK);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(10, 18, 35, 0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, BLOCK, BLOCK);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(px + 3, py + 3, BLOCK - 6, 5);

  ctx.restore();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 246, 255, 0.08)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(canvas.width, y * BLOCK);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMatrix(matrix, offset, color, alpha = 1) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(x + offset.x, y + offset.y, color, alpha);
      }
    });
  });
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) return;

  const matrix = nextPiece.matrix;
  const color = COLORS[nextPiece.type];

  const blockSize = 24;
  const matrixWidth = matrix[0].length * blockSize;
  const matrixHeight = matrix.length * blockSize;

  const offsetX = (nextCanvas.width - matrixWidth) / 2;
  const offsetY = (nextCanvas.height - matrixHeight) / 2;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      const px = offsetX + x * blockSize;
      const py = offsetY + y * blockSize;

      nextCtx.save();

      nextCtx.shadowBlur = 12;
      nextCtx.shadowColor = color;
      nextCtx.fillStyle = color;
      nextCtx.fillRect(px, py, blockSize, blockSize);

      nextCtx.shadowBlur = 0;
      nextCtx.strokeStyle = "rgba(10, 18, 35, 0.85)";
      nextCtx.lineWidth = 2;
      nextCtx.strokeRect(px, py, blockSize, blockSize);

      nextCtx.fillStyle = "rgba(255,255,255,0.18)";
      nextCtx.fillRect(px + 2, py + 2, blockSize - 4, 4);

      nextCtx.restore();
    });
  });
}

function drawGhost() {
  if (!player) return;
  
  const ghostY = getGhostY();
  drawMatrix(player.matrix, { x: player.pos.x, y: ghostY }, COLORS[player.type], 0.18);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        drawCell(x, y, cell);
      }
    });
  });

  drawGrid();

  if (!isGameOver && player) {
    drawGhost();
    drawMatrix(player.matrix, player.pos, COLORS[player.type]);
  }

  drawClearingRows();

  if (isPaused || isGameOver) {
    drawOverlay(isGameOver ? "ПРОИГРЫШ" : "ПАУЗА");
  }
}

function drawClearingRows() {
  if (!isClearing) return;

  const progress = Math.min(
    (performance.now() - clearAnimationStart) / CLEAR_ANIMATION_DURATION,
    1
  );

  const glowAlpha = 0.35 + (1 - progress) * 0.65;
  const inset = progress * (BLOCK / 2);

  clearingRows.forEach((rowY) => {
    for (let x = 0; x < COLS; x++) {
      const px = x * BLOCK;
      const py = rowY * BLOCK;

      ctx.save();

      ctx.globalAlpha = glowAlpha;
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#ffffff";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px + inset / 2, py + 2, BLOCK - inset, BLOCK - 4);

      ctx.shadowBlur = 18;
      ctx.shadowColor = "#00f6ff";
      ctx.strokeStyle = "#00f6ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + inset / 2, py + 2, BLOCK - inset, BLOCK - 4);

      ctx.restore();
    }
  });
}

function drawOverlay(text) {
  ctx.save();
  ctx.fillStyle = "rgba(2, 6, 20, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 30px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ff2bd6";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function collide(matrix = player.matrix, pos = player.pos) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;

      const nextX = pos.x + x;
      const nextY = pos.y + y;

      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
        return true;
      }

      if (nextY >= 0 && board[nextY][nextX]) {
        return true;
      }
    }
  }

  return false;
}

function merge() {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      const boardY = player.pos.y + y;
      const boardX = player.pos.x + x;

      if (boardY >= 0) {
        board[boardY][boardX] = COLORS[player.type];
      }
    });
  });
}

function clearLines() {
  const fullRows = [];

  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x]) {
        continue outer;
      }
    }

    fullRows.push(y);
  }

  if (fullRows.length > 0) {
    clearingRows = fullRows;
    clearAnimationStart = performance.now();
    isClearing = true;
    return true;
  }

  return false;
}

function finishLineClear() {
  const cleared = clearingRows.length;

  clearingRows
    .sort((a, b) => b - a)
    .forEach((rowIndex) => {
      const row = board.splice(rowIndex, 1)[0].fill(0);
      board.unshift(row);
    });

  lines += cleared;
  score += SCORE_TABLE[cleared] * level;
  level = Math.floor(lines / 10) + 1;

  if (score > best) {
    best = score;
    localStorage.setItem("cyberpunk-tetris-best", String(best));
  }

  clearingRows = [];
  isClearing = false;
  updateUI();
}

function spawnPiece() {
  player = {
    type: nextPiece.type,
    matrix: nextPiece.matrix.map((row) => [...row]),
    pos: {
      x: Math.floor(COLS / 2) - Math.ceil(nextPiece.matrix[0].length / 2),
      y: 0,
    },
  };

  nextPiece = randomPiece();
  drawNextPiece();

  if (collide()) {
    isGameOver = true;
    updateStatus("ЗАВЕРШЕНО", "gameover");
  }
}

function playerDrop() {
  player.pos.y++;

  if (collide()) {
    player.pos.y--;
    merge();

    const hasLinesToClear = clearLines();

    if (!hasLinesToClear) {
      spawnPiece();
    }
  }

  dropCounter = 0;
}

function hardDrop() {
  while (!collide(player.matrix, { x: player.pos.x, y: player.pos.y + 1 })) {
    player.pos.y++;
  }
  playerDrop();
}

function playerMove(direction) {
  player.pos.x += direction;
  if (collide()) {
    player.pos.x -= direction;
  }
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function playerRotate() {
  const originalMatrix = player.matrix.map((row) => [...row]);
  const originalX = player.pos.x;

  player.matrix = rotate(player.matrix);

  let offset = 1;
  while (collide()) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));

    if (Math.abs(offset) > player.matrix[0].length) {
      player.matrix = originalMatrix;
      player.pos.x = originalX;
      return;
    }
  }
}

function getDropInterval() {
  return Math.max(90, 800 - (level - 1) * 60);
}

function getGhostY() {
  let ghostY = player.pos.y;

  while (!collide(player.matrix, { x: player.pos.x, y: ghostY + 1 })) {
    ghostY++;
  }

  return ghostY;
}

function togglePause() {
  if (isGameOver) return;

  isPaused = !isPaused;
  updateStatus(
    isPaused ? "ПАУЗА" : "В ИГРЕ",
    isPaused ? "paused" : "playing"
  );
  updateUI();
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (isClearing) {
    if (time - clearAnimationStart >= CLEAR_ANIMATION_DURATION) {
      finishLineClear();
      spawnPiece();
    }
  } else if (!isPaused && !isGameOver) {
    dropCounter += deltaTime;

    if (dropCounter > getDropInterval()) {
      playerDrop();
    }
  }

  drawBoard();
  animationId = requestAnimationFrame(update);
}

document.addEventListener("keydown", (event) => {
  if (isGameOver && event.code !== "Enter") return;
  if (isClearing) return;

  switch (event.code) {
    case "ArrowLeft":
      if (!isPaused) playerMove(-1);
      break;
    case "ArrowRight":
      if (!isPaused) playerMove(1);
      break;
    case "ArrowDown":
      if (!isPaused) playerDrop();
      break;
    case "ArrowUp":
      if (!isPaused) playerRotate();
      break;
    case "Space":
      event.preventDefault();
      if (!isPaused) hardDrop();
      break;
    case "KeyP":
      togglePause();
      break;
    case "Enter":
      if (isGameOver) resetGame();
      break;
  }
});

restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);
clearBestBtn.addEventListener("click", () => {
  best = 0;
  localStorage.removeItem("cyberpunk-tetris-best");
  updateUI();
});

resetGame();

// УПРАВЛЕНИЕ кнопками
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const downBtn = document.getElementById("downBtn");
const rotateBtn = document.getElementById("rotateBtn");
const dropBtn = document.getElementById("dropBtn");

function bindTouchButton(button, action) {
  if (!button) return;

  const handler = (event) => {
    event.preventDefault();
    if (isPaused || isGameOver || isClearing) return;
    action();
  };

  button.addEventListener("click", handler);
  button.addEventListener("touchstart", handler, { passive: false });
}

bindTouchButton(leftBtn, () => playerMove(-1));
bindTouchButton(rightBtn, () => playerMove(1));
bindTouchButton(downBtn, () => playerDrop());
bindTouchButton(rotateBtn, () => playerRotate());
bindTouchButton(dropBtn, () => hardDrop());