export const BOARD_ROWS = 9;
export const BOARD_COLS = 7;
export const CELL_COUNT = BOARD_ROWS * BOARD_COLS;
export const START_ROW = 4;
export const START_COL = 3;
export const START_INDEX = START_ROW * BOARD_COLS + START_COL; // 31
export const MAX_PATH_LENGTH = 16; // start + 15 steps

export const CHEST_VALUES = [0, 10, 20, 50] as const;
export type ChestValue = (typeof CHEST_VALUES)[number];

export type ChestColor = 'empty' | 'green' | 'purple' | 'red';
export type Direction = 'u' | 'd' | 'l' | 'r';

export interface CellPathInfo {
  from: Direction | null;
  to: Direction | null;
  arrowDir: Direction | null;
  isStart: boolean;
}

export interface TreasureCell {
  value: ChestValue;
  path: CellPathInfo | null;
}

export interface PathStep {
  row: number;
  col: number;
  direction: Direction | '';
}

export interface SolvePathResult {
  profit: number;
  steps: PathStep[];
}

export const CHEST_VALUE_TO_COLOR: Record<ChestValue, ChestColor> = {
  0: 'empty',
  10: 'green',
  20: 'purple',
  50: 'red',
};

export const CHEST_COLOR_TO_VALUE: Record<ChestColor, ChestValue> = {
  empty: 0,
  green: 10,
  purple: 20,
  red: 50,
};

export const CHEST_LABEL_BY_VALUE: Record<ChestValue, string> = {
  0: '空地',
  10: '绿宝箱 (+10)',
  20: '紫宝箱 (+20)',
  50: '红宝箱 (+50)',
};

export const CHEST_ICON_BY_VALUE: Partial<Record<ChestValue, string>> = {
  10: '/icons/treasure-hunt/box-green.png',
  20: '/icons/treasure-hunt/box-purple.png',
  50: '/icons/treasure-hunt/box-red.png',
};

export const HERO_ICON_PATH = '/icons/treasure-hunt/hero.webp';
export const COIN_ICON_PATH = '/icons/treasure-hunt/coin.png';

export function createEmptyBoard(): TreasureCell[] {
  return Array.from({ length: CELL_COUNT }, () => ({
    value: 0,
    path: null,
  }));
}

/**
 * Cycles chest type in `[0, 10, 20, 50]` forward (or backward when `reverse` is true).
 */
export function cycleChestValue(
  current: ChestValue,
  reverse = false,
): ChestValue {
  const index = CHEST_VALUES.indexOf(current);
  const delta = reverse ? -1 : 1;
  return CHEST_VALUES[(index + delta + CHEST_VALUES.length) % CHEST_VALUES.length];
}
