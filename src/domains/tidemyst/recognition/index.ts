import type { BoardSize } from '../models';
import {
  cellRect,
  classifyCell,
  cropPixels,
  detectGrid,
  type GridDetection,
  type Pixels,
  type RecognitionCell,
} from './pixels';

export * from './pixels';
export * from './gameBoard';
export * from './glyph';
export * from './gameDigitTemplates';
export * from './dimensions';
export * from './sioFusion';

export interface TidemystPixelRecognitionResult {
  grid: GridDetection;
  cells: RecognitionCell[];
  reviewCount: number;
}

/**
 * Pure pixel-based Tidemyst board recognition (zero DOM / Tesseract dependency).
 */
export function recognizeTidemystBoardFromPixels(
  image: Pixels,
  preferredSize?: BoardSize,
): TidemystPixelRecognitionResult {
  const grid = detectGrid(image, preferredSize);
  const total = grid.size * grid.size;
  const cells: RecognitionCell[] = [];
  let reviewCount = 0;

  for (let i = 0; i < total; i++) {
    const patch = cropPixels(image, cellRect(grid.rect, grid.size, i));
    const recognized = classifyCell(patch, [], grid.profile);
    if (recognized.needsReview) reviewCount += 1;
    cells.push(recognized);
  }

  return { grid, cells, reviewCount };
}
