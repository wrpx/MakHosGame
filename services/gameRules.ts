import { BoardState, Move, Piece, PieceType, Player, Position } from '../types';

const BOARD_SIZE = 8;

// Initialize standard board (8 pieces each for Thai Checkers, rows 0,1 and 6,7)
export const createInitialBoard = (): BoardState => {
  const board: BoardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 2) board[row][col] = { player: Player.Black, type: PieceType.Man };
        if (row > 5) board[row][col] = { player: Player.Red, type: PieceType.Man };
      }
    }
  }
  return board;
};

const isValidPos = (r: number, c: number) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

// Helper to compare positions
export const isSamePos = (p1: Position, p2: Position) => p1.row === p2.row && p1.col === p2.col;

// --- Move Generation ---

export const getValidMoves = (board: BoardState, player: Player, mustMovePiece: Position | null = null): Move[] => {
  let moves: Move[] = [];

  // If a piece is locked (in a chain capture), only check moves for that piece
  if (mustMovePiece) {
    const piece = board[mustMovePiece.row][mustMovePiece.col];
    if (piece && piece.player === player) {
      moves = getPieceMoves(board, mustMovePiece, piece);
    }
  } else {
    // Otherwise check all pieces
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.player === player) {
          moves.push(...getPieceMoves(board, { row: r, col: c }, piece));
        }
      }
    }
  }

  // Filter for forced captures (Thai Rule: Must capture if available)
  const captureMoves = moves.filter(m => m.isCapture);
  if (captureMoves.length > 0) {
    return captureMoves;
  }

  return moves;
};

const getPieceMoves = (board: BoardState, pos: Position, piece: Piece): Move[] => {
  if (piece.type === PieceType.Man) {
    return getManMoves(board, pos, piece.player);
  } else {
    return getKingMoves(board, pos, piece.player);
  }
};

const getManMoves = (board: BoardState, pos: Position, player: Player): Move[] => {
  const moves: Move[] = [];
  const directions = player === Player.Red ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]; // Forward diag
  const captureDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // Can capture backwards in some variations? 
  // Thai Rules: Man cannot move backwards, CANNOT capture backwards usually. 
  // Standard Thai rules: Man moves forward, Captures forward only.
  // Let's stick to strict Thai: Capture forward only.
  
  const moveDirs = directions;
  const capDirs = directions; // In strict Thai checkers, men capture forward only.

  // 1. Simple Moves
  moveDirs.forEach(([dr, dc]) => {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    if (isValidPos(nr, nc) && board[nr][nc] === null) {
      moves.push({ from: pos, to: { row: nr, col: nc }, isCapture: false });
    }
  });

  // 2. Captures
  capDirs.forEach(([dr, dc]) => {
    const midR = pos.row + dr;
    const midC = pos.col + dc;
    const landR = pos.row + dr * 2;
    const landC = pos.col + dc * 2;

    if (isValidPos(landR, landC)) {
      const midPiece = board[midR][midC];
      const landSquare = board[landR][landC];
      
      if (midPiece && midPiece.player !== player && landSquare === null) {
        moves.push({
          from: pos,
          to: { row: landR, col: landC },
          isCapture: true,
          capturedPiece: { row: midR, col: midC }
        });
      }
    }
  });

  return moves;
};

const getKingMoves = (board: BoardState, pos: Position, player: Player): Move[] => {
  const moves: Move[] = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  directions.forEach(([dr, dc]) => {
    let r = pos.row + dr;
    let c = pos.col + dc;
    let foundOpponent = false;
    let opponentPos: Position | null = null;

    while (isValidPos(r, c)) {
      const currentPiece = board[r][c];

      if (currentPiece === null) {
        // If we haven't found an opponent yet, it's a valid walk move
        if (!foundOpponent) {
           moves.push({ from: pos, to: { row: r, col: c }, isCapture: false });
        } else {
          // If we HAVE found an opponent, this empty spot is a valid landing for capture
          // Thai Rule: Flying king can land anywhere after the captured piece
          if (opponentPos) {
             moves.push({
               from: pos,
               to: { row: r, col: c },
               isCapture: true,
               capturedPiece: opponentPos
             });
             // FIX: Force stop immediately after landing behind the captured piece
             break;
          }
        }
      } else if (currentPiece.player === player) {
        // Blocked by own piece
        break;
      } else {
        // Found an opponent
        if (foundOpponent) {
          // Already jumped one, hit another -> cannot double jump in one straight line effectively or blocked
          break;
        }
        foundOpponent = true;
        opponentPos = { row: r, col: c };
      }
      
      r += dr;
      c += dc;
    }
  });

  return moves;
};

// --- State Update ---

export const executeMove = (currentBoard: BoardState, move: Move): { newBoard: BoardState, promoted: boolean } => {
  // Deep copy
  const newBoard = currentBoard.map(row => row.map(p => p ? { ...p } : null));
  const piece = newBoard[move.from.row][move.from.col];
  
  if (!piece) throw new Error("No piece at from position");

  // Move piece
  newBoard[move.to.row][move.to.col] = piece;
  newBoard[move.from.row][move.from.col] = null;

  // Remove captured
  if (move.isCapture && move.capturedPiece) {
    newBoard[move.capturedPiece.row][move.capturedPiece.col] = null;
  }

  // Promotion Check
  let promoted = false;
  if (piece.type === PieceType.Man) {
    if ((piece.player === Player.Red && move.to.row === 0) || 
        (piece.player === Player.Black && move.to.row === BOARD_SIZE - 1)) {
      piece.type = PieceType.King;
      promoted = true;
    }
  }

  return { newBoard, promoted };
};

export const checkWinner = (board: BoardState): Player | null => {
  let redCount = 0;
  let blackCount = 0;
  let redMoves = 0;
  let blackMoves = 0;

  // Count pieces
  for(let r=0; r<BOARD_SIZE; r++){
    for(let c=0; c<BOARD_SIZE; c++){
      if(board[r][c]?.player === Player.Red) redCount++;
      if(board[r][c]?.player === Player.Black) blackCount++;
    }
  }

  if (redCount === 0) return Player.Black;
  if (blackCount === 0) return Player.Red;

  // Check for valid moves (stalemate condition)
  const redValid = getValidMoves(board, Player.Red);
  const blackValid = getValidMoves(board, Player.Black);

  if (redValid.length === 0) return Player.Black;
  if (blackValid.length === 0) return Player.Red;

  return null;
};