const SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const boardEl = document.getElementById("board");
const blackCountEl = document.getElementById("black-count");
const whiteCountEl = document.getElementById("white-count");
const turnIndicatorEl = document.getElementById("turn-indicator");
const statusEl = document.getElementById("status");
const matchEl = document.getElementById("match");
const restartBtn = document.getElementById("restart");
const toggleHintsBtn = document.getElementById("toggle-hints");
const difficultySelect = document.getElementById("difficulty");
const depthSelect = document.getElementById("depth");

let board = [];
let currentPlayer = BLACK;
let showHints = true;
let aiDifficulty = difficultySelect.value;
let aiThinking = false;
let HUMAN = BLACK;
let AI = WHITE;
let hardDepth = Number(depthSelect.value);
let lastMove = null;

const directions = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const createBoard = () => {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  const mid = SIZE / 2;
  board[mid - 1][mid - 1] = WHITE;
  board[mid][mid] = WHITE;
  board[mid - 1][mid] = BLACK;
  board[mid][mid - 1] = BLACK;
  currentPlayer = BLACK;
};

const inBounds = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

const opponent = (player) => (player === BLACK ? WHITE : BLACK);

const getFlips = (row, col, player, boardState = board) => {
  if (boardState[row][col] !== EMPTY) return [];
  const flips = [];

  directions.forEach(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;
    const line = [];

    while (inBounds(r, c) && boardState[r][c] === opponent(player)) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }

    if (line.length > 0 && inBounds(r, c) && boardState[r][c] === player) {
      flips.push(...line);
    }
  });

  return flips;
};

const getValidMoves = (player, boardState = board) => {
  const moves = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (boardState[row][col] !== EMPTY) continue;
      const flips = getFlips(row, col, player, boardState);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }

  return moves;
};

const applyMove = (move, player = currentPlayer, boardState = board) => {
  boardState[move.row][move.col] = player;
  move.flips.forEach(([r, c]) => {
    boardState[r][c] = player;
  });
};

const counts = (boardState = board) => {
  let black = 0;
  let white = 0;

  boardState.flat().forEach((cell) => {
    if (cell === BLACK) black += 1;
    if (cell === WHITE) white += 1;
  });

  return { black, white };
};

const updateStats = () => {
  const { black, white } = counts();
  blackCountEl.textContent = black;
  whiteCountEl.textContent = white;
  turnIndicatorEl.textContent = currentPlayer === BLACK ? "흑" : "백";
};

const cloneBoard = (boardState) => boardState.map((row) => row.slice());

const positionalWeights = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

const evaluateBoard = (boardState, player) => {
  const { black, white } = counts(boardState);
  const playerCount = player === BLACK ? black : white;
  const opponentCount = player === BLACK ? white : black;

  let positional = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (boardState[row][col] === player) positional += positionalWeights[row][col];
      if (boardState[row][col] === opponent(player)) positional -= positionalWeights[row][col];
    }
  }

  const mobility =
    getValidMoves(player, boardState).length - getValidMoves(opponent(player), boardState).length;
  const discDiff = playerCount - opponentCount;

  return positional + mobility * 4 + discDiff * 2;
};

const minimax = (boardState, depth, player, maximizing, alpha, beta) => {
  const moves = getValidMoves(player, boardState);
  if (depth === 0) {
    return evaluateBoard(boardState, AI);
  }

  if (moves.length === 0) {
    const opponentMoves = getValidMoves(opponent(player), boardState);
    if (opponentMoves.length === 0) {
      return evaluateBoard(boardState, AI);
    }
    return minimax(boardState, depth - 1, opponent(player), !maximizing, alpha, beta);
  }

  if (maximizing) {
    let best = -Infinity;
    moves.forEach((move) => {
      const nextBoard = cloneBoard(boardState);
      applyMove(move, player, nextBoard);
      const score = minimax(nextBoard, depth - 1, opponent(player), false, alpha, beta);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) return;
    });
    return best;
  }

  let best = Infinity;
  moves.forEach((move) => {
    const nextBoard = cloneBoard(boardState);
    applyMove(move, player, nextBoard);
    const score = minimax(nextBoard, depth - 1, opponent(player), true, alpha, beta);
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) return;
  });
  return best;
};

const chooseAIMove = (validMoves) => {
  if (validMoves.length === 0) return null;

  if (aiDifficulty === "easy") {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  if (aiDifficulty === "medium") {
    let bestMove = validMoves[0];
    let bestScore = -Infinity;

    validMoves.forEach((move) => {
      const nextBoard = cloneBoard(board);
      applyMove(move, AI, nextBoard);
      const opponentMoves = getValidMoves(HUMAN, nextBoard).length;
      const isCorner =
        (move.row === 0 && move.col === 0) ||
        (move.row === 0 && move.col === 7) ||
        (move.row === 7 && move.col === 0) ||
        (move.row === 7 && move.col === 7);
      const isEdge = move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7;
      const score =
        move.flips.length * 2 + (isEdge ? 6 : 0) + (isCorner ? 80 : 0) - opponentMoves * 3;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });

    return bestMove;
  }

  let bestMove = validMoves[0];
  let bestScore = -Infinity;
  const depth = Math.max(2, Math.min(5, hardDepth));
  validMoves.forEach((move) => {
    const nextBoard = cloneBoard(board);
    applyMove(move, AI, nextBoard);
    const score = minimax(nextBoard, depth, HUMAN, false, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });
  return bestMove;
};

const maybeAutoMove = () => {
  if (currentPlayer !== AI || aiThinking) return;
  const validMoves = getValidMoves(currentPlayer);
  if (validMoves.length === 0) return;

  aiThinking = true;
  boardEl.parentElement.classList.add("locked");
  statusEl.textContent = "AI가 생각 중입니다...";
  setTimeout(() => {
    const chosen = chooseAIMove(validMoves);
    if (chosen) {
      applyMove(chosen, AI);
      lastMove = { row: chosen.row, col: chosen.col, flips: chosen.flips };
      currentPlayer = opponent(currentPlayer);
    }
    aiThinking = false;
    boardEl.parentElement.classList.remove("locked");
    renderBoard();
  }, 350);
};

const renderBoard = () => {
  const validMoves = getValidMoves(currentPlayer);
  boardEl.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.row = row;
      cell.dataset.col = col;

      const value = board[row][col];
      if (value === BLACK || value === WHITE) {
        const disk = document.createElement("div");
        disk.className = `disk ${value === BLACK ? "black" : "white"}`;
        if (lastMove && lastMove.row === row && lastMove.col === col) {
          disk.classList.add("spawn");
        }
        if (lastMove && lastMove.flips?.some(([r, c]) => r === row && c === col)) {
          disk.classList.add("flip");
        }
        cell.appendChild(disk);
      }

      if (showHints && validMoves.some((move) => move.row === row && move.col === col)) {
        cell.classList.add("hint");
      }

      boardEl.appendChild(cell);
    }
  }

  updateStats();
  updateStatus(validMoves);
  maybeAutoMove();
};

const updateStatus = (validMoves) => {
  if (validMoves.length === 0) {
    const opponentMoves = getValidMoves(opponent(currentPlayer));
    if (opponentMoves.length === 0) {
      const { black, white } = counts();
      if (black === white) {
        statusEl.textContent = "무승부입니다. 다시 도전해볼까요?";
      } else if (black > white) {
        statusEl.textContent = "흑이 승리했습니다!";
      } else {
        statusEl.textContent = "백이 승리했습니다!";
      }
      return;
    }

    statusEl.textContent = "놓을 수 있는 칸이 없어 턴이 넘어갑니다.";
    currentPlayer = opponent(currentPlayer);
    setTimeout(renderBoard, 450);
    return;
  }

  const whose = currentPlayer === HUMAN ? "당신" : "AI";
  statusEl.textContent = `${whose}의 차례입니다.`;
};

const handleClick = (event) => {
  if (currentPlayer !== HUMAN || aiThinking) return;
  const cell = event.target.closest(".cell");
  if (!cell) return;

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const possibleMoves = getValidMoves(currentPlayer);
  const chosen = possibleMoves.find((move) => move.row === row && move.col === col);

  if (!chosen) return;

  applyMove(chosen);
  lastMove = { row, col, flips: chosen.flips };
  currentPlayer = opponent(currentPlayer);
  renderBoard();
};

const restart = () => {
  const coin = Math.random() < 0.5;
  HUMAN = coin ? BLACK : WHITE;
  AI = opponent(HUMAN);
  matchEl.textContent = `당신: ${HUMAN === BLACK ? "흑" : "백"} · AI: ${
    AI === BLACK ? "흑" : "백"
  }`;
  createBoard();
  lastMove = null;
  renderBoard();
};

const toggleHints = () => {
  showHints = !showHints;
  toggleHintsBtn.textContent = showHints ? "힌트 끄기" : "힌트 켜기";
  renderBoard();
};

difficultySelect.addEventListener("change", () => {
  aiDifficulty = difficultySelect.value;
  if (currentPlayer === AI) {
    renderBoard();
  }
});

depthSelect.addEventListener("change", () => {
  hardDepth = Number(depthSelect.value);
  if (currentPlayer === AI) {
    renderBoard();
  }
});

boardEl.addEventListener("click", handleClick);
restartBtn.addEventListener("click", restart);
toggleHintsBtn.addEventListener("click", toggleHints);

restart();
