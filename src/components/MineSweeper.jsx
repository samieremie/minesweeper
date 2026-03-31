import { useState } from "react";
import { useStopwatch } from "react-timer-hook";
import { clsx } from "clsx";
import Cell from "./Cell";
import "./MineSweeper.css";

const boards = {
  easy: { height: 8, width: 10, mineCount: 10 },
  medium: { height: 14, width: 18, mineCount: 40 },
  hard: { height: 20, width: 24, mineCount: 99 },
};

const ASSETS = {
  FLAG: "https://www.google.com/logos/fnbx/minesweeper/flag_icon.png",
  CLOCK: "https://www.google.com/logos/fnbx/minesweeper/clock_icon.png",
  BOMB: "💣", // You could even put your emoji here!
};

export default function MineSweeper(props) {
  // Difficulty level
  const [difficulty, setDifficulty] = useState("easy");
  const { height, width, mineCount } = boards[difficulty];

  // State values.
  const [grid, setGrid] = useState(() =>
    initializeGame(height, width, mineCount),
  );
  const [remainingFlags, setRemainingFlags] = useState(
    boards[difficulty].mineCount,
  );
  const [gameLost, setGameLost] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const { totalSeconds, reset, pause } = useStopwatch({
    autoStart: true,
  });

  // Initialization
  function initializeGame(h, w, m) {
    // Initialize a empty grid
    const grid = [];
    for (let row = 0; row < h; row++) {
      const newRow = [];
      for (let col = 0; col < w; col++) {
        const newCell = {
          isRevealed: false,
          isMined: false,
          isFlagged: false,
          bombsNear: 0,
        };
        newRow.push(newCell);
      }
      grid.push(newRow);
    }

    return grid;
  }

  function plantMines(currentGrid, firstRow, firstCol, m) {
    const h = currentGrid.length;
    const w = currentGrid[0].length;
    let minesPlaced = 0;

    // Get coordinates of the first click and all its neighbors
    const protectedCells = getNeighbors(firstRow, firstCol, w, h);
    protectedCells.push([firstRow, firstCol]);
    const protectedSet = new Set(protectedCells.map(([r, c]) => `${r}-${c}`));

    while (minesPlaced < m) {
      const r = Math.floor(Math.random() * h);
      const c = Math.floor(Math.random() * w);

      // Only place mine if it's not mined AND not in the protected area
      if (!currentGrid[r][c].isMined && !protectedSet.has(`${r}-${c}`)) {
        currentGrid[r][c].isMined = true;
        minesPlaced++;
      }
    }

    countBombsNear(currentGrid, h, w);
    return currentGrid;
  }

  function restartGame(newDifficulty) {
    const config = boards[newDifficulty];
    setDifficulty(newDifficulty);
    setGrid(initializeGame(config.height, config.width, config.mineCount));
    setRemainingFlags(config.mineCount);
    setGameLost(false);
    setGameWon(false);
    reset(); // Restarts the stopwatch
  }

  function getNeighbors(row, col, width, height) {
    const offsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    let neighbors = [];
    offsets.map((offset) => {
      const neighRow = row + offset[0];
      const neighCol = col + offset[1];
      if (
        0 <= neighRow &&
        neighRow < height &&
        0 <= neighCol &&
        neighCol < width
      )
        neighbors.push([neighRow, neighCol]);
    });
    return neighbors;
  }

  function countBombsNear(grid, height, width) {
    // Go over each grid cell
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        // Count the bombs near for each grid cell
        const neighbors = getNeighbors(row, col, width, height);
        const bombsNear = neighbors.reduce(
          (count, [r, c]) => (grid[r][c].isMined ? count + 1 : count),
          0,
        );
        grid[row][col].bombsNear = bombsNear;
      }
    }
  }

  // Reveal the cell that is left clicked
  function handleLeftClick(row, col) {
    if (grid[row][col].isRevealed || grid[row][col].isFlagged || isRevealing)
      return;

    let currentGrid = grid;

    // Check if this is the first click (no cells revealed yet)
    const isFirstClick = !grid.some((rowArray) =>
      rowArray.some((cell) => cell.isRevealed),
    );

    if (isFirstClick) {
      // Deep clone the grid to avoid direct state mutation
      const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
      currentGrid = plantMines(newGrid, row, col, mineCount);
      // Note: We don't setGrid yet because revealCells will do it
    }

    if (grid[row][col].isMined) {
      pause();
      // Reveal the one the user actually clicked immediately
      const clickedGrid = grid.map((r, ri) =>
        r.map((c, ci) =>
          ri === row && ci === col ? { ...c, isRevealed: true } : c,
        ),
      );
      setGrid(clickedGrid);

      // Start the slow reveal for the rest
      revealMinesSequentially(clickedGrid);
    } else {
      const newGrid = revealCells(row, col, currentGrid);
      setGrid(newGrid);
      // Check if game is won
      checkGameWon(newGrid);
    }
  }

  // Flag the cell right clicked
  function handleRightClick(e, row, col) {
    e.preventDefault();
    const cell = grid[row][col];
    if (gameWon || gameLost || cell.isRevealed) return;

    // 1. Calculate the new state for this specific cell
    const newFlagStatus = !cell.isFlagged;
    if (!newFlagStatus && remainingFlags === 0 && !cell.isFlagged) return;

    // 2. Create the updated grid manually to check for win immediately
    const newGrid = grid.map((r, ri) =>
      r.map((c, ci) =>
        ri === row && ci === col ? { ...c, isFlagged: newFlagStatus } : c,
      ),
    );

    // 3. Update states
    setGrid(newGrid);
    setRemainingFlags((prev) => (newFlagStatus ? prev - 1 : prev + 1));

    // 4. Check for win using the newly created grid
    checkGameWon(newGrid);
  }

  async function revealMinesSequentially(clickedGrid) {
    setIsRevealing(true); // LOCK the board
    pause(); // Stop the timer immediately

    const minePositions = [];
    clickedGrid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.isMined && !cell.isRevealed) {
          minePositions.push({ r, c });
        }
      });
    });

    for (const pos of minePositions) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      setGrid((prevGrid) =>
        prevGrid.map((rowArr, ri) =>
          rowArr.map((cell, ci) =>
            ri === pos.r && ci === pos.c ? { ...cell, isRevealed: true } : cell,
          ),
        ),
      );
    }

    setIsRevealing(false); // UNLOCK (though gameLost will now keep it locked)
    setGameLost(true); // Show the "You Lost" overlay
  }

  function revealCells(row, col, existingGrid = null) {
    const cells = [[row, col]];
    const seen = new Set(); // To track what we've already added to the stack
    const newGrid = (existingGrid || grid).map((rowArray) =>
      rowArray.map((cell) => ({ ...cell })),
    );

    // Loop to cascade discovering of cells
    while (cells.length !== 0) {
      const [r, c] = cells.pop();
      if (newGrid[r][c].isRevealed || seen.has(`${r}-${c}`)) continue;

      seen.add(`${r}-${c}`);
      newGrid[r][c].isRevealed = true;

      if (newGrid[r][c].bombsNear === 0) {
        const neighbors = getNeighbors(r, c, grid[0].length, grid.length);
        for (const [nr, nc] of neighbors) {
          if (!newGrid[nr][nc].isRevealed) {
            cells.push([nr, nc]);
          }
        }
      }
    }
    return newGrid;
  }

  function checkGameWon(currentGrid) {
    const flatGrid = currentGrid.flat();
    const totalCells = height * width;

    // Condition 1: All non-mine cells are revealed
    const revealedCells = flatGrid.filter((cell) => cell.isRevealed).length;
    const allRevealed = totalCells - revealedCells === mineCount;

    // Condition 2: All mines are flagged (and no false flags exist)
    const correctlyFlagged = flatGrid.filter(
      (cell) => cell.isMined && cell.isFlagged,
    ).length;
    const allMinesFlagged = correctlyFlagged === mineCount;

    if (allRevealed || allMinesFlagged) {
      setGameWon(true);
      pause();
      return true;
    }
    return false;
  }

  function handleDifficultyChange(e) {
    restartGame(e.target.value);
  }

  const gridElements = grid.map((row, rowIndex) => {
    return (
      <div key={rowIndex} className="row">
        {row.map((cell, colIndex) => {
          const isEven = (rowIndex + colIndex) % 2 === 0;

          const cellClass = clsx("cell", {
            // Not Revealed
            "light-green": !cell.isRevealed && isEven,
            "dark-green": !cell.isRevealed && !isEven,
            // Revealed
            "light-tan": cell.isRevealed && isEven,
            "dark-tan": cell.isRevealed && !isEven,
            // Flagged
            flagged: cell.isFlagged,
          });

          return (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              cellClass={cellClass}
              handleLeftClick={handleLeftClick}
              handleRightClick={handleRightClick}
              bombsNear={cell.bombsNear}
              isDisabled={gameLost || gameWon}
            >
              {cell.isRevealed && !cell.isMined && cell.bombsNear > 0
                ? cell.bombsNear
                : ""}
              {cell.isRevealed && cell.isMined && (
                <span className="bomb-icon">💣</span>
              )}
              {!cell.isRevealed && cell.isFlagged && (
                <img src={ASSETS.FLAG} alt="🚩" className="cell-flag-icon" />
              )}
            </Cell>
          );
        })}
      </div>
    );
  });

  return (
    <div className="grid-container">
      <div className="grid-wrapper">
        <div className="header">
          <select
            name="difficulty"
            id="difficulty-dropdown"
            onChange={handleDifficultyChange}
          >
            <option value="easy">Facile</option>
            <option value="medium">Moyen</option>
            <option value="hard">Difficile</option>
          </select>

          <div className="flags-remaining">
            <img
              src={ASSETS.FLAG}
              alt="Flags remaining"
              className="header-icon"
            />
            <span>{remainingFlags}</span>
          </div>
          <div className="timer">
            <img
              src={ASSETS.CLOCK}
              alt="Time elapsed"
              className="header-icon"
            />
            {String(totalSeconds).padStart(3, "0")}
          </div>
        </div>

        {/* THE OVERLAY */}
        {(gameWon || gameLost) && (
          <div className="game-over-overlay">
            <div className="message-card">
              <h2>{gameWon ? "Tu as gagné!" : "Tu as perdu!"}</h2>
              <button
                className="play-again"
                onClick={() => window.location.reload()}
              >
                Joue à nouveau
              </button>
            </div>
          </div>
        )}

        <div className="grid">{gridElements}</div>
      </div>
    </div>
  );
}
