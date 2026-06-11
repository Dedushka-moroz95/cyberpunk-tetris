const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const nextPreviews = Array.from(document.querySelectorAll("[data-next-index]"))
  .map((canvas) => ({
    canvas,
    ctx: canvas.getContext("2d"),
    index: Number(canvas.dataset.nextIndex || 0),
    blockSize: Number(canvas.dataset.previewBlockSize || 18),
  }))
  .sort((a, b) => a.index - b.index);
const holdPreviews = Array.from(document.querySelectorAll("[data-hold-preview]"))
  .map((canvas) => ({
    canvas,
    ctx: canvas.getContext("2d"),
    blockSize: Number(canvas.dataset.previewBlockSize || 18),
  }));

const scoreMobileEl = document.getElementById("scoreMobile");
const linesMobileEl = document.getElementById("linesMobile");
const levelMobileEl = document.getElementById("levelMobile");
const mobilePauseBtn = document.getElementById("mobilePauseBtn");
const touchButtons = document.querySelectorAll("[data-action]");
const gameOverlayEl = document.getElementById("gameOverlay");
const overlayKickerEl = document.getElementById("overlayKicker");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayMessageEl = document.getElementById("overlayMessage");
const overlayScoreEl = document.getElementById("overlayScore");
const overlayLinesEl = document.getElementById("overlayLines");
const overlayLevelEl = document.getElementById("overlayLevel");
const overlayBestEl = document.getElementById("overlayBest");
const overlayPrimaryBtn = document.getElementById("overlayPrimaryBtn");
const overlayRestartBtn = document.getElementById("overlayRestartBtn");
const gameEffectsEl = document.getElementById("gameEffects");
const feedbackPopEl = document.getElementById("feedbackPop");
const canvasWrapEl = document.querySelector(".canvas-wrap");

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
const BLOCK = 30;
const BOARD_WIDTH = COLS * BLOCK;
const BOARD_HEIGHT = ROWS * BLOCK;
const MAX_PIXEL_RATIO = 2;
const NEXT_QUEUE_SIZE = 4;

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
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;
const ROTATION_STATES = 4;
const DEFAULT_WALL_KICKS = {
  "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
};
const I_WALL_KICKS = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
};

let board = [];
let player = null;
let nextQueue = [];
let holdPiece = null;
let canHold = true;
let score = 0;
let lines = 0;
let level = 1;
let best = Number(localStorage.getItem("cyberpunk-tetris-best") || 0);
let lastTime = 0;
let dropCounter = 0;
let isPaused = false;
let isGameOver = false;
let gameStarted = false;
let animationId = null;
let pieceBag = [];
let lockCounter = 0;
let lockResetCount = 0;
let clearingRows = [];
let clearAnimationStart = 0;
let isClearing = false;
const CLEAR_ANIMATION_DURATION = 180;

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let activePointerId = null;
let repeatDelayId = null;
let repeatIntervalId = null;
let previousScore = score;
let previousLines = lines;
let previousLevel = level;
let previousBest = best;
let recordAnnounced = false;

const TAP_THRESHOLD = 10;
const SWIPE_THRESHOLD = 28;
const HARD_DROP_SWIPE_THRESHOLD = 110;
const REPEAT_DELAY = 170;
const REPEAT_INTERVAL = 65;

bestEl.textContent = best;
setupCanvasScale();
window.addEventListener("resize", setupCanvasScale);

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function setupCanvasScale() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const width = Math.floor(BOARD_WIDTH * pixelRatio);
  const height = Math.floor(BOARD_HEIGHT * pixelRatio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  canvas.style.aspectRatio = `${COLS} / ${ROWS}`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function saveBestScore() {
  if (score > best) {
    best = score;
    localStorage.setItem("cyberpunk-tetris-best", String(best));
  }
}

function addScore(points) {
  if (!points) return;

  score += points;
  saveBestScore();
  updateUI();
}

function refillPieceBag() {
  pieceBag = Object.keys(SHAPES);

  for (let i = pieceBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceBag[i], pieceBag[j]] = [pieceBag[j], pieceBag[i]];
  }
}

function createPiece(type) {
  return {
    type,
    matrix: SHAPES[type].map((row) => [...row]),
    rotation: 0,
    pos: {
      x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
      y: 0,
    },
  };
}

function randomPiece() {
  if (pieceBag.length === 0) {
    refillPieceBag();
  }

  const type = pieceBag.pop();

  return createPiece(type);
}

function ensureNextQueue() {
  while (nextQueue.length < NEXT_QUEUE_SIZE) {
    nextQueue.push(randomPiece());
  }
}

function takeNextPiece() {
  ensureNextQueue();

  const piece = nextQueue.shift();
  ensureNextQueue();

  return piece;
}

function updateStatus(text, state) {
  statusEl.textContent = text;
  statusEl.className = "status " + state;
  updateOverlay();
}

function restartCssAnimation(element, className) {
  if (!element) return;

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function vibrate(pattern) {
  if (!("vibrate" in navigator)) return false;

  return navigator.vibrate(pattern);
}

function triggerHapticFallback(type) {
  if (!canvasWrapEl) return;

  const fallbackClass =
    type === "record" || type === "tetris"
      ? "haptic-strong"
      : type === "line"
        ? "haptic-medium"
        : "haptic-soft";

  canvasWrapEl.classList.remove("haptic-soft", "haptic-medium", "haptic-strong");
  void canvasWrapEl.offsetWidth;
  canvasWrapEl.classList.add(fallbackClass);
}

function flashGameEffect(type) {
  if (!gameEffectsEl) return;

  gameEffectsEl.className = "game-effects";
  void gameEffectsEl.offsetWidth;
  gameEffectsEl.classList.add(`flash-${type}`);
}

function showFeedback(text, type = "line") {
  if (!feedbackPopEl) return;

  feedbackPopEl.textContent = text;
  feedbackPopEl.dataset.type = type;
  restartCssAnimation(feedbackPopEl, "is-visible");
}

function triggerFeedback(type, text, vibrationPattern) {
  flashGameEffect(type);
  showFeedback(text, type);

  if (!vibrate(vibrationPattern)) {
    triggerHapticFallback(type);
  }
}

function bumpElement(element, className = "stat-bump") {
  restartCssAnimation(element, className);
}

function updateOverlay() {
  if (!gameOverlayEl) return;

  const shouldShow = !gameStarted || isPaused || isGameOver;

  gameOverlayEl.classList.toggle("is-hidden", !shouldShow);
  gameOverlayEl.setAttribute("aria-hidden", String(!shouldShow));

  if (overlayScoreEl) overlayScoreEl.textContent = score;
  if (overlayLinesEl) overlayLinesEl.textContent = lines;
  if (overlayLevelEl) overlayLevelEl.textContent = level;
  if (overlayBestEl) overlayBestEl.textContent = best;

  if (!shouldShow) return;

  overlayRestartBtn.classList.add("is-hidden");

  if (!gameStarted) {
    overlayKickerEl.textContent = "CYBERPUNK TETRIS";
    overlayTitleEl.textContent = "Готов к запуску";
    overlayMessageEl.textContent = "Поле свободно. Можно начинать.";
    overlayPrimaryBtn.textContent = "Начать игру";
    return;
  }

  if (isGameOver) {
    overlayKickerEl.textContent = "СЕАНС ЗАВЕРШЕН";
    overlayTitleEl.textContent = "Игра окончена";
    overlayMessageEl.textContent = "Финальная статистика ниже.";
    overlayPrimaryBtn.textContent = "Играть снова";
    return;
  }

  overlayKickerEl.textContent = "ПАУЗА";
  overlayTitleEl.textContent = "Раунд остановлен";
  overlayMessageEl.textContent = "Продолжишь с того же места.";
  overlayPrimaryBtn.textContent = "Продолжить";
  overlayRestartBtn.classList.remove("is-hidden");
}

function updateUI() {
  const scoreChanged = score !== previousScore;
  const linesChanged = lines !== previousLines;
  const levelChanged = level !== previousLevel;
  const bestChanged = best !== previousBest;

  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  bestEl.textContent = best;

  if (scoreMobileEl) scoreMobileEl.textContent = score;
  if (linesMobileEl) linesMobileEl.textContent = lines;
  if (levelMobileEl) levelMobileEl.textContent = level;

  pauseBtn.textContent = isPaused ? "Продолжить" : "Пауза";

  if (mobilePauseBtn) {
    mobilePauseBtn.textContent = isPaused ? "▶" : "⏸";
  }

  updateOverlay();

  if (scoreChanged) {
    bumpElement(scoreEl);
    bumpElement(scoreMobileEl);
    bumpElement(overlayScoreEl);
  }

  if (linesChanged) {
    bumpElement(linesEl);
    bumpElement(linesMobileEl);
    bumpElement(overlayLinesEl);
  }

  if (levelChanged) {
    bumpElement(levelEl);
    bumpElement(levelMobileEl);
    bumpElement(overlayLevelEl);
  }

  if (bestChanged) {
    bumpElement(bestEl, "record-glow");
    bumpElement(overlayBestEl, "record-glow");

    if (
      gameStarted &&
      previousBest > 0 &&
      score > 0 &&
      score === best &&
      !recordAnnounced
    ) {
      recordAnnounced = true;
      triggerFeedback("record", "Новый рекорд", [35, 40, 55]);
    }
  }

  previousScore = score;
  previousLines = lines;
  previousLevel = level;
  previousBest = best;
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
  gameStarted = true;
  recordAnnounced = false;
  pieceBag = [];
  nextQueue = [];
  holdPiece = null;
  canHold = true;
  lockCounter = 0;
  lockResetCount = 0;

  clearingRows = [];
  clearAnimationStart = 0;
  isClearing = false;

  ensureNextQueue();
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
  const inset = alpha < 1 ? 4 : 2;
  const size = BLOCK - inset * 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.shadowBlur = alpha < 1 ? 8 : 10;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillRect(px + inset, py + inset, size, size);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(5, 12, 28, 0.88)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + inset, py + inset, size, size);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(px + inset + 3, py + inset + 3, size - 6, 4);

  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(px + inset + 3, py + inset + size - 6, size - 6, 3);

  ctx.restore();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 246, 255, 0.08)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, BOARD_HEIGHT);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(BOARD_WIDTH, y * BLOCK);
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

function getMatrixBounds(matrix) {
  let minX = matrix[0].length;
  let minY = matrix.length;
  let maxX = -1;
  let maxY = -1;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  return { minX, minY, maxX, maxY };
}

function drawPreviewCell(ctx, x, y, size, color) {
  ctx.save();

  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(10, 18, 35, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, size, size);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x + 2, y + 2, size - 4, 3);

  ctx.restore();
}

function drawPreviewPiece(target, piece) {
  const { ctx, canvas, blockSize } = target;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!piece) return;

  const matrix = piece.matrix;
  const color = COLORS[piece.type];
  const bounds = getMatrixBounds(matrix);

  if (bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) return;

  const matrixWidth = (bounds.maxX - bounds.minX + 1) * blockSize;
  const matrixHeight = (bounds.maxY - bounds.minY + 1) * blockSize;
  const offsetX = (canvas.width - matrixWidth) / 2;
  const offsetY = (canvas.height - matrixHeight) / 2;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      drawPreviewCell(
        ctx,
        offsetX + (x - bounds.minX) * blockSize,
        offsetY + (y - bounds.minY) * blockSize,
        blockSize,
        color
      );
    });
  });
}

function drawPiecePreviews() {
  nextPreviews.forEach((target) => {
    drawPreviewPiece(target, nextQueue[target.index]);
  });

  holdPreviews.forEach((target) => {
    drawPreviewPiece(target, holdPiece);
  });
}

function drawGhost() {
  if (!player) return;
  
  const ghostY = getGhostY();
  drawMatrix(player.matrix, { x: player.pos.x, y: ghostY }, COLORS[player.type], 0.18);
}

function drawBoard() {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        drawCell(x, y, cell);
      }
    });
  });

  drawGrid();

  if (gameStarted && !isGameOver && player) {
    drawGhost();
    drawMatrix(player.matrix, player.pos, COLORS[player.type]);
  }

  drawClearingRows();
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

    if (fullRows.length === 4) {
      triggerFeedback("tetris", "Тетрис", [30, 35, 30, 35, 70]);
    } else {
      triggerFeedback(
        "line",
        fullRows.length === 1 ? "Линия" : `${fullRows.length} линии`,
        [22, 28, 38]
      );
    }

    return true;
  }

  return false;
}

function finishLineClear() {
  const cleared = clearingRows.length;
  const rowsToClear = new Set(clearingRows);
  const remainingRows = board.filter((_, rowIndex) => !rowsToClear.has(rowIndex));
  const emptyRows = Array.from({ length: cleared }, () => Array(COLS).fill(0));

  board = [...emptyRows, ...remainingRows];

  const lineScore = SCORE_TABLE[cleared] * level;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  addScore(lineScore);

  clearingRows = [];
  isClearing = false;
  updateUI();
}

function resetLockState() {
  lockCounter = 0;
  lockResetCount = 0;
}

function createActivePiece(piece) {
  return {
    type: piece.type,
    matrix: SHAPES[piece.type].map((row) => [...row]),
    rotation: 0,
    pos: {
      x: Math.floor(COLS / 2) - Math.ceil(SHAPES[piece.type][0].length / 2),
      y: 0,
    },
  };
}

function spawnPiece() {
  const nextPiece = takeNextPiece();

  player = createActivePiece(nextPiece);
  resetLockState();
  canHold = true;
  drawPiecePreviews();

  if (collide()) {
    isGameOver = true;
    updateStatus("ЗАВЕРШЕНО", "gameover");
  }
}

function holdCurrentPiece() {
  if (!canControlPiece() || !canHold) return false;

  const currentPiece = createPiece(player.type);

  if (holdPiece) {
    const swappedPiece = holdPiece;
    holdPiece = currentPiece;
    player = createActivePiece(swappedPiece);
    resetLockState();

    if (collide()) {
      isGameOver = true;
      updateStatus("ЗАВЕРШЕНО", "gameover");
    }
  } else {
    holdPiece = currentPiece;
    spawnPiece();
  }

  canHold = false;
  drawPiecePreviews();
  return true;
}

function canControlPiece() {
  return gameStarted && !isPaused && !isGameOver && !isClearing && player;
}

function isPieceGrounded() {
  return Boolean(
    player &&
      collide(player.matrix, { x: player.pos.x, y: player.pos.y + 1 })
  );
}

function resetLockDelayAfterMove() {
  if (!player) return;

  if (isPieceGrounded()) {
    if (lockResetCount < MAX_LOCK_RESETS) {
      lockCounter = 0;
      lockResetCount++;
    }
    return;
  }

  lockCounter = 0;
}

function lockPiece() {
  if (!player || isClearing || isGameOver) return;

  merge();

  const hasLinesToClear = clearLines();

  if (hasLinesToClear) {
    player = null;
  } else {
    spawnPiece();
  }

  dropCounter = 0;
}

function playerDrop(scoreDrop = false) {
  if (!player) return false;

  if (collide(player.matrix, { x: player.pos.x, y: player.pos.y + 1 })) {
    return false;
  }

  player.pos.y++;

  if (scoreDrop) {
    addScore(1);
  }

  dropCounter = 0;
  if (!isPieceGrounded()) {
    lockCounter = 0;
  }

  return true;
}

function hardDrop() {
  if (!player) return;

  let dropped = 0;

  while (!collide(player.matrix, { x: player.pos.x, y: player.pos.y + 1 })) {
    player.pos.y++;
    dropped++;
  }

  if (dropped > 0) {
    addScore(dropped * 2);
    triggerFeedback("drop", `+${dropped * 2}`, 18);
  }

  lockPiece();
}

function playerMove(direction) {
  if (!player) return false;

  player.pos.x += direction;
  if (collide()) {
    player.pos.x -= direction;
    return false;
  }

  resetLockDelayAfterMove();
  return true;
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function getWallKicks(type, fromRotation, toRotation) {
  if (type === "O") return [[0, 0]];

  const key = `${fromRotation}>${toRotation}`;
  const kicks = type === "I" ? I_WALL_KICKS : DEFAULT_WALL_KICKS;

  return kicks[key] || [[0, 0]];
}

function playerRotate() {
  if (!player) return false;

  const originalMatrix = player.matrix.map((row) => [...row]);
  const originalPos = { ...player.pos };
  const originalRotation = player.rotation;
  const nextRotation = (player.rotation + 1) % ROTATION_STATES;
  const rotatedMatrix = rotate(player.matrix);

  for (const [offsetX, offsetY] of getWallKicks(
    player.type,
    originalRotation,
    nextRotation
  )) {
    player.matrix = rotatedMatrix;
    player.pos.x = originalPos.x + offsetX;
    player.pos.y = originalPos.y + offsetY;

    if (!collide()) {
      player.rotation = nextRotation;
      resetLockDelayAfterMove();
      return true;
    }
  }

  player.matrix = originalMatrix;
  player.pos = originalPos;
  player.rotation = originalRotation;
  return false;
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
  if (!gameStarted || isGameOver || isClearing) return;

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

  if (!gameStarted) {
    drawBoard();
    animationId = requestAnimationFrame(update);
    return;
  }

  if (isClearing) {
    if (time - clearAnimationStart >= CLEAR_ANIMATION_DURATION) {
      finishLineClear();
      spawnPiece();
    }
  } else if (!isPaused && !isGameOver) {
    if (isPieceGrounded()) {
      lockCounter += deltaTime;
      dropCounter = 0;

      if (lockCounter >= LOCK_DELAY) {
        lockPiece();
      }
    } else {
      lockCounter = 0;
      dropCounter += deltaTime;

      if (dropCounter > getDropInterval()) {
        playerDrop();
      }
    }
  }

  drawBoard();
  animationId = requestAnimationFrame(update);
}

function performControlAction(action) {
  if (action === "start") {
    if (isPaused && gameStarted && !isGameOver) {
      togglePause();
      return;
    }

    if (!gameStarted || isGameOver) resetGame();
    return;
  }

  if (!gameStarted || isGameOver) {
    if (action !== "pause") resetGame();
    return;
  }

  if (action === "pause") {
    togglePause();
    return;
  }

  if (!canControlPiece()) return;

  switch (action) {
    case "left":
      playerMove(-1);
      break;
    case "right":
      playerMove(1);
      break;
    case "soft-drop":
      playerDrop(true);
      break;
    case "rotate":
      playerRotate();
      break;
    case "hold":
      holdCurrentPiece();
      break;
    case "hard-drop":
      hardDrop();
      break;
  }
}

const KEY_ACTIONS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "soft-drop",
  ArrowUp: "rotate",
  Space: "hard-drop",
  KeyC: "hold",
  ShiftLeft: "hold",
  ShiftRight: "hold",
  KeyP: "pause",
  Enter: "start",
};

document.addEventListener("keydown", (event) => {
  const action = KEY_ACTIONS[event.code];

  if (!action) return;

  event.preventDefault();
  performControlAction(action);
});

restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", () => performControlAction("pause"));
clearBestBtn.addEventListener("click", () => {
  best = 0;
  localStorage.removeItem("cyberpunk-tetris-best");
  updateUI();
});

if (overlayPrimaryBtn) {
  overlayPrimaryBtn.addEventListener("click", () => {
    if (isPaused && gameStarted && !isGameOver) {
      togglePause();
      return;
    }

    resetGame();
  });
}

if (overlayRestartBtn) {
  overlayRestartBtn.addEventListener("click", resetGame);
}

if (mobilePauseBtn) {
  mobilePauseBtn.addEventListener("click", () => {
    performControlAction("pause");
  });
}

function isRepeatableAction(action) {
  return action === "left" || action === "right" || action === "soft-drop";
}

function stopRepeatingAction() {
  window.clearTimeout(repeatDelayId);
  window.clearInterval(repeatIntervalId);
  repeatDelayId = null;
  repeatIntervalId = null;
}

function startRepeatingAction(action) {
  const shouldRepeat = isRepeatableAction(action) && canControlPiece();

  stopRepeatingAction();
  performControlAction(action);

  if (!shouldRepeat) return;

  repeatDelayId = window.setTimeout(() => {
    repeatIntervalId = window.setInterval(() => {
      performControlAction(action);
    }, REPEAT_INTERVAL);
  }, REPEAT_DELAY);
}

touchButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    startRepeatingAction(button.dataset.action);
  });

  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    stopRepeatingAction();
  });

  button.addEventListener("pointercancel", stopRepeatingAction);
  button.addEventListener("lostpointercapture", stopRepeatingAction);
  button.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();

  activePointerId = e.pointerId;
  canvas.setPointerCapture?.(e.pointerId);
  touchStartX = e.clientX;
  touchStartY = e.clientY;
});

canvas.addEventListener("pointerup", (e) => {
  if (activePointerId !== null && e.pointerId !== activePointerId) return;

  e.preventDefault();

  touchEndX = e.clientX;
  touchEndY = e.clientY;
  activePointerId = null;

  handleGesture();
});

canvas.addEventListener("pointercancel", () => {
  activePointerId = null;
});

updateUI();
drawBoard();
animationId = requestAnimationFrame(update);

function handleGesture() {
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  if (!gameStarted) {
    resetGame();
    return;
  }

  if (isGameOver) {
    resetGame();
    return;
  }

  if (isClearing) return;

  if (!canControlPiece()) return;

  if (Math.abs(dx) < TAP_THRESHOLD && Math.abs(dy) < TAP_THRESHOLD) {
    performControlAction("rotate");
    return;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > SWIPE_THRESHOLD) {
      performControlAction("right");
    } else if (dx < -SWIPE_THRESHOLD) {
      performControlAction("left");
    }
  } else {
    if (dy > HARD_DROP_SWIPE_THRESHOLD) {
      performControlAction("hard-drop");
    } else if (dy > SWIPE_THRESHOLD) {
      performControlAction("soft-drop");
    } else if (dy < -SWIPE_THRESHOLD) {
      performControlAction("rotate");
    }
  }
}
