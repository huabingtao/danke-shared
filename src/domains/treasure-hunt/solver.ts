import {
  BOARD_COLS,
  BOARD_ROWS,
  CELL_COUNT,
  MAX_PATH_LENGTH,
  START_COL,
  START_ROW,
  type Direction,
  type PathStep,
  type SolvePathResult,
  type TreasureCell,
} from './models';

const DIRECTIONS: ReadonlyArray<{ dr: number; dc: number; dir: Direction }> = [
  { dr: -1, dc: 0, dir: 'u' },
  { dr: 1, dc: 0, dir: 'd' },
  { dr: 0, dc: -1, dir: 'l' },
  { dr: 0, dc: 1, dir: 'r' },
];

const OPPOSITE_DIR: Record<Direction, Direction> = {
  u: 'd',
  d: 'u',
  l: 'r',
  r: 'l',
};

/**
 * Finds the exact 15-step (16-cell) path from center `(4, 3)` that maximizes chest value.
 * Uses exact admissible branch-and-bound pruning while keeping identical tie-breaking to DFS.
 */
export function solveTreasurePath(
  cells: readonly TreasureCell[],
): SolvePathResult {
  const values = new Int32Array(CELL_COUNT);
  const positiveIndices: number[] = [];

  for (let i = 0; i < CELL_COUNT; i++) {
    const val = cells[i]?.value ?? 0;
    values[i] = val;
    if (val > 0 && i !== START_ROW * BOARD_COLS + START_COL) {
      positiveIndices.push(i);
    }
  }

  // Sort positive-value cells descending for tight admissible upper bounds.
  positiveIndices.sort((a, b) => values[b] - values[a]);
  const posRows = positiveIndices.map((idx) => Math.floor(idx / BOARD_COLS));
  const posCols = positiveIndices.map((idx) => idx % BOARD_COLS);
  const posVals = positiveIndices.map((idx) => values[idx]);

  const visited = new Uint8Array(CELL_COUNT);
  const startIdx = START_ROW * BOARD_COLS + START_COL;
  visited[startIdx] = 1;

  const currentSteps: PathStep[] = [
    { row: START_ROW, col: START_COL, direction: '' },
  ];
  let bestProfit = 0;
  let bestSteps: PathStep[] = [];

  function upperBound(row: number, col: number, remainingSteps: number): number {
    let bound = 0;
    let picked = 0;
    for (let i = 0; i < positiveIndices.length && picked < remainingSteps; i++) {
      const idx = positiveIndices[i];
      if (visited[idx]) continue;
      const dist = Math.abs(posRows[i] - row) + Math.abs(posCols[i] - col);
      if (dist <= remainingSteps) {
        bound += posVals[i];
        picked += 1;
      }
    }
    return bound;
  }

  function dfs(row: number, col: number, depth: number, profit: number): void {
    if (depth === MAX_PATH_LENGTH) {
      if (profit > bestProfit) {
        bestProfit = profit;
        bestSteps = currentSteps.map((s) => ({ ...s }));
      }
      return;
    }

    const remaining = MAX_PATH_LENGTH - depth;
    if (profit + upperBound(row, col, remaining) <= bestProfit) {
      return;
    }

    for (let i = 0; i < DIRECTIONS.length; i++) {
      const { dr, dc, dir } = DIRECTIONS[i];
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (
        nextRow < 0 ||
        nextRow >= BOARD_ROWS ||
        nextCol < 0 ||
        nextCol >= BOARD_COLS
      ) {
        continue;
      }
      const nextIdx = nextRow * BOARD_COLS + nextCol;
      if (visited[nextIdx]) continue;

      visited[nextIdx] = 1;
      currentSteps.push({ row: nextRow, col: nextCol, direction: dir });
      dfs(nextRow, nextCol, depth + 1, profit + values[nextIdx]);
      currentSteps.pop();
      visited[nextIdx] = 0;
    }
  }

  dfs(START_ROW, START_COL, 1, values[startIdx]);

  return {
    profit: bestProfit,
    steps: bestSteps,
  };
}

/**
 * Applies solved path metadata (`from`, `to`, `arrowDir`, `isStart`) onto a cloned cell array.
 */
export function applySolvedPath(
  cells: readonly TreasureCell[],
  steps: readonly PathStep[],
): TreasureCell[] {
  const cleared: TreasureCell[] = cells.map((cell) => ({
    value: cell.value,
    path: null,
  }));
  if (steps.length < 2) return cleared;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const index = step.row * BOARD_COLS + step.col;
    const isLast = i === steps.length - 1;
    const isStart = i === 0;
    const nextDir = isLast ? null : (steps[i + 1].direction as Direction);

    cleared[index] = {
      value: cleared[index].value,
      path: {
        from: isStart
          ? null
          : step.direction
            ? OPPOSITE_DIR[step.direction]
            : null,
        to: nextDir,
        arrowDir: nextDir,
        isStart,
      },
    };
  }

  return cleared;
}
