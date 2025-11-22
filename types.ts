export enum Player {
  None = 0,
  Red = 1,   // Bottom Player (Moves Up)
  Black = 2, // Top Player (Moves Down)
}

export enum PieceType {
  Man = 'man',
  King = 'king',
}

export interface Piece {
  player: Player;
  type: PieceType;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  isCapture: boolean;
  capturedPiece?: Position; // The position of the piece being removed
}

export type BoardState = (Piece | null)[][]; // 8x8 grid

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  winner: Player | null;
  turnCount: number;
  // For handling multi-jump sequences
  activePiece: Position | null; // If non-null, only this piece can move (chain capture)
}

export enum GameMode {
  PvP = 'pvp',
  PvBot = 'pvbot',
}

export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}
