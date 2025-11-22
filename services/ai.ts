import { BoardState, Difficulty, Move, PieceType, Player, Position } from '../types';
import { checkWinner, executeMove, getValidMoves } from './gameRules';

// Weights for evaluation
const SCORES = {
  MAN: 100,
  KING: 300, // Kings are significantly stronger in Thai Checkers (Flying Kings)
  WIN: 10000,
};

/**
 * Evaluate the board from the perspective of the Max player (Bot/Black)
 */
const evaluateBoard = (board: BoardState, player: Player): number => {
  let score = 0;
  const winner = checkWinner(board);
  
  if (winner === player) return SCORES.WIN;
  if (winner && winner !== player) return -SCORES.WIN;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const value = piece.type === PieceType.King ? SCORES.KING : SCORES.MAN;
      
      if (piece.player === player) {
        score += value;
        // Slight bonus for advancing men (optional, helps in early game)
        if (piece.type === PieceType.Man) {
           score += (player === Player.Red ? (7-r) : r) * 2; 
        }
      } else {
        score -= value;
        if (piece.type === PieceType.Man) {
           score -= (piece.player === Player.Red ? (7-r) : r) * 2; 
        }
      }
    }
  }
  return score;
};

/**
 * Minimax with Alpha-Beta Pruning
 */
const minimax = (
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  player: Player, // The bot's identity
  activePiece: Position | null // Handle multi-jump simulation
): number => {
  const winner = checkWinner(board);
  if (depth === 0 || winner) {
    return evaluateBoard(board, player);
  }

  const currentPlayer = maximizingPlayer ? player : (player === Player.Red ? Player.Black : Player.Red);
  const validMoves = getValidMoves(board, currentPlayer, activePiece);

  if (validMoves.length === 0) {
    // No moves available implies loss for current player
    return maximizingPlayer ? -SCORES.WIN : SCORES.WIN;
  }

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of validMoves) {
      const { newBoard, promoted } = executeMove(board, move);
      
      // Handle chain jumps in recursion
      let nextActivePiece: Position | null = null;
      let isTurnChange = true;
      
      if (move.isCapture && !promoted) {
         // Check if chain jump is possible
         const nextMoves = getValidMoves(newBoard, currentPlayer, move.to);
         if (nextMoves.some(m => m.isCapture)) {
           nextActivePiece = move.to;
           isTurnChange = false;
         }
      }

      let evalScore;
      if (!isTurnChange) {
        // If chain jump, it's still the same player's turn, but depth doesn't decrease yet?
        // Simplification: We treat chain jumps as part of the same depth to avoid infinite loops, 
        // but usually checkers engines flatten moves. Here we just recurse.
        evalScore = minimax(newBoard, depth, alpha, beta, true, player, nextActivePiece);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, player, null);
      }

      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of validMoves) {
      const { newBoard, promoted } = executeMove(board, move);
      
      let nextActivePiece: Position | null = null;
      let isTurnChange = true;

      if (move.isCapture && !promoted) {
         const nextMoves = getValidMoves(newBoard, currentPlayer, move.to);
         if (nextMoves.some(m => m.isCapture)) {
           nextActivePiece = move.to;
           isTurnChange = false;
         }
      }

      let evalScore;
      if (!isTurnChange) {
        evalScore = minimax(newBoard, depth, alpha, beta, false, player, nextActivePiece);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, player, null);
      }

      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getBotMove = (
  board: BoardState, 
  botPlayer: Player, 
  difficulty: Difficulty, 
  activePiece: Position | null
): Move | null => {
  const validMoves = getValidMoves(board, botPlayer, activePiece);
  
  if (validMoves.length === 0) return null;

  // 1. Easy: Random Move
  if (difficulty === Difficulty.Easy) {
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return validMoves[randomIndex];
  }

  // 2. Medium & Hard: Minimax
  // Medium = Depth 2, Hard = Depth 4
  const depth = difficulty === Difficulty.Medium ? 2 : 4;
  
  let bestMove = validMoves[0];
  let maxEval = -Infinity;

  // Shuffle moves to add variety if scores are equal
  const shuffledMoves = validMoves.sort(() => Math.random() - 0.5);

  for (const move of shuffledMoves) {
    const { newBoard, promoted } = executeMove(board, move);
    
    // Check if this move continues the turn (chain jump)
    let nextActivePiece: Position | null = null;
    let isTurnChange = true;
    if (move.isCapture && !promoted) {
        const nextMoves = getValidMoves(newBoard, botPlayer, move.to);
        if (nextMoves.some(m => m.isCapture)) {
          nextActivePiece = move.to;
          isTurnChange = false;
        }
    }

    let evalScore;
    if (!isTurnChange) {
       // If we are stuck in a chain jump, evaluate that state as maximizing player
       evalScore = minimax(newBoard, depth, -Infinity, Infinity, true, botPlayer, nextActivePiece);
    } else {
       // Turn passes to opponent (minimizing)
       evalScore = minimax(newBoard, depth - 1, -Infinity, Infinity, false, botPlayer, null);
    }

    if (evalScore > maxEval) {
      maxEval = evalScore;
      bestMove = move;
    }
  }

  return bestMove;
};
