import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Trophy, Info, Crown, Cpu, User, Settings } from 'lucide-react';
import { GameState, Move, PieceType, Player, Position, GameMode, Difficulty } from './types';
import { createInitialBoard, getValidMoves, executeMove, checkWinner, isSamePos } from './services/gameRules';
import { getBotMove } from './services/ai';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>({
    board: createInitialBoard(),
    currentPlayer: Player.Red, // Red starts
    winner: null,
    turnCount: 1,
    activePiece: null,
  });

  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  
  // Settings State
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.PvBot);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // --- Computed ---
  
  // Get all valid moves for the current player/state
  const validMoves = useMemo(() => {
    if (gameState.winner) return [];
    return getValidMoves(gameState.board, gameState.currentPlayer, gameState.activePiece);
  }, [gameState.board, gameState.currentPlayer, gameState.activePiece, gameState.winner]);

  // Get valid destination squares for the currently selected piece
  const validDestinations = useMemo(() => {
    if (!selectedPos) return [];
    return validMoves.filter(m => isSamePos(m.from, selectedPos));
  }, [validMoves, selectedPos]);

  // Check if any move is a capture (to show UI hints)
  const isForceCapture = validMoves.some(m => m.isCapture);

  const isBotTurn = gameMode === GameMode.PvBot && gameState.currentPlayer === Player.Black && !gameState.winner;

  // --- AI Effect ---
  useEffect(() => {
    if (isBotTurn) {
      setIsBotThinking(true);
      
      // Artificial delay for realism
      const timer = setTimeout(() => {
        const move = getBotMove(gameState.board, Player.Black, difficulty, gameState.activePiece);
        if (move) {
          handleMoveExecution(move);
        }
        setIsBotThinking(false);
      }, 600); // 600ms thinking time

      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayer, gameState.activePiece, isBotTurn, gameState.board, difficulty]);


  // --- Handlers ---

  const handleSquareClick = (row: number, col: number) => {
    if (gameState.winner || isBotThinking || (isBotTurn && !gameState.winner)) return;

    const clickedPos = { row, col };
    const clickedPiece = gameState.board[row][col];

    // 1. If clicking a destination of a valid move, execute it
    const move = validDestinations.find(m => isSamePos(m.to, clickedPos));
    
    if (move) {
      handleMoveExecution(move);
      return;
    }

    // 2. If clicking own piece, select it (unless locked by activePiece)
    if (clickedPiece && clickedPiece.player === gameState.currentPlayer) {
      // If we are in a multi-jump sequence, we can only select the active piece
      if (gameState.activePiece && !isSamePos(gameState.activePiece, clickedPos)) {
        return; // Cannot select other pieces during chain capture
      }

      // Allow selection only if this piece has valid moves
      const hasMoves = validMoves.some(m => isSamePos(m.from, clickedPos));
      if (hasMoves) {
        setSelectedPos(clickedPos);
      } else {
         setSelectedPos(null); 
      }
    } else {
      // Clicking empty space or opponent -> Deselect
      if (!gameState.activePiece) {
        setSelectedPos(null);
      }
    }
  };

  const handleMoveExecution = (move: Move) => {
    const { newBoard, promoted } = executeMove(gameState.board, move);
    
    let nextPlayer = gameState.currentPlayer;
    let nextActivePiece: Position | null = null;
    let winner = checkWinner(newBoard);

    // Logic for Chain Captures (Double Jumps)
    if (move.isCapture && !promoted) {
      // If it was a capture and NOT promoted, check if the SAME piece can capture again from the NEW position
      const chainMoves = getValidMoves(newBoard, gameState.currentPlayer, move.to);
      if (chainMoves.some(m => m.isCapture)) {
        // Must continue jumping
        nextActivePiece = move.to;
        // If it's human turn, select it automatically
        if (gameMode === GameMode.PvP || gameState.currentPlayer === Player.Red) {
           setSelectedPos(move.to); 
        }
      } else {
        // No more captures, switch turn
        nextPlayer = gameState.currentPlayer === Player.Red ? Player.Black : Player.Red;
        setSelectedPos(null);
      }
    } else {
      // Regular move or Promoted -> Turn ends
      nextPlayer = gameState.currentPlayer === Player.Red ? Player.Black : Player.Red;
      setSelectedPos(null);
    }

    setGameState(prev => ({
      ...prev,
      board: newBoard,
      currentPlayer: nextPlayer,
      activePiece: nextActivePiece,
      winner: winner,
      turnCount: nextPlayer === prev.currentPlayer ? prev.turnCount : prev.turnCount + 1
    }));
  };

  const resetGame = () => {
    setGameState({
      board: createInitialBoard(),
      currentPlayer: Player.Red,
      winner: null,
      turnCount: 1,
      activePiece: null,
    });
    setSelectedPos(null);
    setIsBotThinking(false);
  };

  // --- Render Helpers ---

  const getSquareColor = (r: number, c: number) => {
    const isDark = (r + c) % 2 === 1;
    return isDark ? 'bg-[#8B5E3C]' : 'bg-[#F3E5AB]';
  };

  const getHighlight = (r: number, c: number) => {
    // Don't show highlights for human during bot turn
    if (isBotThinking) return '';

    // Highlight selected piece
    if (selectedPos && selectedPos.row === r && selectedPos.col === c) {
      return 'ring-4 ring-yellow-400 ring-inset';
    }
    
    // Highlight valid destinations
    const isDestination = validDestinations.some(m => m.to.row === r && m.to.col === c);
    if (isDestination) {
      const move = validDestinations.find(m => m.to.row === r && m.to.col === c);
      return move?.isCapture 
        ? 'after:content-[""] after:absolute after:w-4 after:h-4 after:bg-red-500 after:rounded-full after:opacity-60 ring-4 ring-red-400/50 ring-inset' // Threat/Capture
        : 'after:content-[""] after:absolute after:w-4 after:h-4 after:bg-green-500 after:rounded-full after:opacity-60 ring-4 ring-green-400/50 ring-inset'; // Safe move
    }

    return '';
  };

  const getDifficultyLabel = (d: Difficulty) => {
    switch (d) {
      case Difficulty.Easy: return 'ง่าย';
      case Difficulty.Medium: return 'ปานกลาง';
      case Difficulty.Hard: return 'ยาก';
      default: return d;
    }
  };

  return (
    <div className="min-h-screen bg-stone-200 flex flex-col items-center justify-center p-4 font-sans">
      
      {/* Header */}
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-bold text-stone-800 mb-2 drop-shadow-sm">หมากฮอสไทย</h1>
        <p className="text-stone-600 text-sm tracking-wide">Mak-Hot (Thai Checkers)</p>
      </div>

      {/* Settings Panel Toggle */}
      <button 
        onClick={() => setShowSettings(!showSettings)}
        className="mb-4 text-stone-500 hover:text-stone-800 flex items-center gap-2 text-sm underline"
      >
        <Settings size={14} /> {showSettings ? "ซ่อนการตั้งค่า" : "ตั้งค่าเกม"}
      </button>

      {showSettings && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 w-full max-w-[500px] flex flex-col gap-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-stone-700">โหมดการเล่น:</span>
            <div className="flex bg-stone-100 rounded-lg p-1">
              <button 
                onClick={() => { setGameMode(GameMode.PvP); resetGame(); }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${gameMode === GameMode.PvP ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
              >
                ผู้เล่น vs ผู้เล่น
              </button>
              <button 
                 onClick={() => { setGameMode(GameMode.PvBot); resetGame(); }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${gameMode === GameMode.PvBot ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
              >
                เล่นกับบอท
              </button>
            </div>
          </div>

          {gameMode === GameMode.PvBot && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-stone-700">ระดับความยาก:</span>
              <div className="flex gap-2">
                {[Difficulty.Easy, Difficulty.Medium, Difficulty.Hard].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1 text-xs font-bold rounded-md border transition-colors ${difficulty === d ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}
                  >
                    {getDifficultyLabel(d)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game Info Bar */}
      <div className="w-full max-w-[500px] bg-white rounded-xl shadow-lg p-4 mb-6 flex justify-between items-center">
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${gameState.currentPlayer === Player.Red ? 'bg-red-100 border-red-300 border' : 'opacity-50 grayscale'}`}>
          <div className="w-4 h-4 rounded-full bg-red-600 shadow-sm"></div>
          <span className="font-bold text-red-900 flex items-center gap-2">
            <User size={16} /> แดง
          </span>
        </div>

        <div className="text-center">
          <span className="text-xs uppercase text-stone-400 font-bold tracking-wider">ตาที่</span>
          <div className="text-xl font-mono font-bold text-stone-700">{gameState.turnCount}</div>
        </div>

        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${gameState.currentPlayer === Player.Black ? 'bg-stone-800 text-white shadow-md' : 'opacity-50 grayscale'}`}>
           <span className="font-bold flex items-center gap-2">
             ดำ 
             {gameMode === GameMode.PvBot ? <Cpu size={16} /> : <User size={16} />}
           </span>
           <div className="w-4 h-4 rounded-full bg-stone-900 border border-stone-600 shadow-sm"></div>
        </div>
      </div>

      {/* Status Messages */}
      <div className="h-8 mb-2 text-center">
        {gameState.winner ? (
          <span className="text-xl font-bold text-amber-600 animate-bounce flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" /> {gameState.winner === Player.Red ? 'สีแดง' : 'สีดำ'} เป็นฝ่ายชนะ!
          </span>
        ) : (
          <>
            {isBotThinking ? (
              <span className="text-stone-500 font-mono text-sm flex items-center justify-center gap-2">
                <Cpu className="w-4 h-4 animate-pulse" /> บอทกำลังคิด...
              </span>
            ) : (
              <>
                {gameState.activePiece && (
                  <span className="text-orange-600 font-bold text-sm animate-pulse">ต้องกินต่อเนื่อง! (บังคับ)</span>
                )}
                {!gameState.activePiece && isForceCapture && (
                  <span className="text-red-600 font-bold text-sm">มีตาบังคับกิน!</span>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* The Board */}
      <div className={`relative p-3 bg-[#5D4037] rounded-lg shadow-2xl transition-opacity duration-300 ${isBotThinking ? 'opacity-90' : 'opacity-100'}`}>
        <div className="grid grid-cols-8 grid-rows-8 gap-0 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] border-4 border-[#3E2723]">
          {gameState.board.map((row, r) => (
            row.map((piece, c) => {
              // Check if this piece MUST capture
              const isSourceOfCapture = !isBotThinking && validMoves.some(m => m.isCapture && m.from.row === r && m.from.col === c);

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleSquareClick(r, c)}
                  className={`
                    relative w-full h-full flex items-center justify-center 
                    ${getSquareColor(r, c)} 
                    ${getHighlight(r, c)}
                    ${!isBotThinking ? 'cursor-pointer' : 'cursor-default'}
                  `}
                >
                  {/* Tooltip for Forced Capture */}
                  {isSourceOfCapture && (
                    <div className="absolute -top-10 z-20 pointer-events-none">
                       <div className="relative bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded shadow-lg animate-bounce whitespace-nowrap">
                         บังคับกิน!
                         <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-600"></div>
                       </div>
                    </div>
                  )}

                  {piece && (
                    <div className={`
                      w-[80%] h-[80%] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.4)]
                      flex items-center justify-center transition-transform duration-200
                      ${piece.player === Player.Red 
                        ? 'bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-800' 
                        : 'bg-gradient-to-br from-stone-700 to-black border-2 border-stone-600'}
                      ${selectedPos?.row === r && selectedPos?.col === c ? 'scale-110 translate-y-[-2px]' : ''}
                    `}>
                      {piece.type === PieceType.King && (
                        <Crown className={`w-3/5 h-3/5 ${piece.player === Player.Red ? 'text-red-200' : 'text-stone-400'}`} strokeWidth={2.5} />
                      )}
                      {piece.type === PieceType.Man && (
                        <div className={`w-2/3 h-2/3 rounded-full border-2 opacity-30 ${piece.player === Player.Red ? 'border-red-900' : 'border-stone-500'}`}></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex gap-4">
        <button 
          onClick={resetGame}
          className="flex items-center gap-2 px-6 py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-full font-bold transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          <RotateCcw size={18} /> เริ่มเกมใหม่
        </button>
      </div>
      
      {/* Footer */}
      <div className="mt-8 text-stone-500 text-xs flex items-center gap-1">
        <Info size={12} />
        <span>กติกา: หมากฮอสไทย (กินข้ามได้, กินต่อ, ฮอสบิน)</span>
      </div>
    </div>
  );
};

export default App;