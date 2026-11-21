import type { Pixels } from '../tidemyst/recognition/pixels';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CHEST_COLOR_TO_VALUE,
  START_COL,
  START_ROW,
  type ChestColor,
  type ChestValue,
} from './models';

type Rgb = readonly [number, number, number];

const BORDER_OUTER_RGB: Rgb = [118, 58, 38];
const BORDER_INNER_RGB: Rgb = [5, 36, 29];
const EXPECTED_ASPECT_RATIO = 0.749;
const ASPECT_TOLERANCE = 0.1;
const COLOR_DIST_THRESHOLD = 15;

const MODE_PALETTE: Record<'normal' | 'party', Record<ChestColor, Rgb>> = {
  normal: {
    red: [107, 151, 91],
    purple: [97, 150, 126],
    green: [0, 198, 148],
    empty: [0, 201, 132],
  },
  party: {
    red: [232, 174, 0],
    purple: [218, 175, 79],
    green: [116, 227, 11],
    empty: [209, 245, 0],
  },
};

const CHEST_COLORS: readonly ChestColor[] = ['empty', 'green', 'purple', 'red'];

function colorDist(a: Rgb, b: Rgb): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

function getRgb(pixels: Pixels, row: number, col: number): Rgb {
  const clampedRow = Math.max(0, Math.min(pixels.height - 1, row));
  const clampedCol = Math.max(0, Math.min(pixels.width - 1, col));
  const offset = (clampedRow * pixels.width + clampedCol) * 4;
  return [
    pixels.data[offset],
    pixels.data[offset + 1],
    pixels.data[offset + 2],
  ];
}

function getLum(pixels: Pixels, row: number, col: number): number {
  const [r, g, b] = getRgb(pixels, row, col);
  return (r + g + b) / 3;
}

function scanVertical(
  pixels: Pixels,
  col: number,
  startRow: number,
  endRow: number,
  target: Rgb,
  matchBelowThreshold: boolean,
  threshold = COLOR_DIST_THRESHOLD,
): number | undefined {
  const step = startRow <= endRow ? 1 : -1;
  for (
    let row = startRow;
    step > 0 ? row <= endRow : row >= endRow;
    row += step
  ) {
    if (
      (colorDist(getRgb(pixels, row, col), target) < threshold) ===
      matchBelowThreshold
    ) {
      return row;
    }
  }
  return undefined;
}

function scanHorizontal(
  pixels: Pixels,
  row: number,
  startCol: number,
  endCol: number,
  target: Rgb,
  matchBelowThreshold: boolean,
  threshold = COLOR_DIST_THRESHOLD,
): number | undefined {
  const step = startCol <= endCol ? 1 : -1;
  for (
    let col = startCol;
    step > 0 ? col <= endCol : col >= endCol;
    col += step
  ) {
    if (
      (colorDist(getRgb(pixels, row, col), target) < threshold) ===
      matchBelowThreshold
    ) {
      return col;
    }
  }
  return undefined;
}

/**
 * Deterministic 3-means RGB clustering (mirrors OpenCV K=3 dominant color extraction).
 */
function dominantColorKMeans3(
  pixels: Pixels,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Rgb {
  const count = rw * rh;
  if (count <= 0) return [0, 0, 0];

  const samples = new Float32Array(count * 3);
  let ptr = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const idx = (y * pixels.width + x) * 4;
      samples[ptr++] = pixels.data[idx];
      samples[ptr++] = pixels.data[idx + 1];
      samples[ptr++] = pixels.data[idx + 2];
    }
  }

  const seeds = [0, Math.floor(count / 2), Math.max(0, count - 1)];
  const centers: [number, number, number][] = seeds.map((s) => [
    samples[s * 3],
    samples[s * 3 + 1],
    samples[s * 3 + 2],
  ]);

  let best1 = 0;
  let best1Dist = -1;
  for (let i = 0; i < count; i++) {
    const dr = samples[i * 3] - centers[0][0];
    const dg = samples[i * 3 + 1] - centers[0][1];
    const db = samples[i * 3 + 2] - centers[0][2];
    const d = dr * dr + dg * dg + db * db;
    if (d > best1Dist) {
      best1Dist = d;
      best1 = i;
    }
  }
  centers[1] = [
    samples[best1 * 3],
    samples[best1 * 3 + 1],
    samples[best1 * 3 + 2],
  ];

  let best2 = 0;
  let best2Dist = -1;
  for (let i = 0; i < count; i++) {
    const r = samples[i * 3];
    const g = samples[i * 3 + 1];
    const b = samples[i * 3 + 2];
    const d0 =
      (r - centers[0][0]) ** 2 +
      (g - centers[0][1]) ** 2 +
      (b - centers[0][2]) ** 2;
    const d1 =
      (r - centers[1][0]) ** 2 +
      (g - centers[1][1]) ** 2 +
      (b - centers[1][2]) ** 2;
    const dMin = Math.min(d0, d1);
    if (dMin > best2Dist) {
      best2Dist = dMin;
      best2 = i;
    }
  }
  centers[2] = [
    samples[best2 * 3],
    samples[best2 * 3 + 1],
    samples[best2 * 3 + 2],
  ];

  const labels = new Uint8Array(count);
  const sums = new Float64Array(9);
  const counts = new Int32Array(3);

  for (let iter = 0; iter < 10; iter++) {
    sums.fill(0);
    counts.fill(0);
    let changed = false;

    for (let i = 0; i < count; i++) {
      const r = samples[i * 3];
      const g = samples[i * 3 + 1];
      const b = samples[i * 3 + 2];
      let minDist = Infinity;
      let bestK = 0;
      for (let k = 0; k < 3; k++) {
        const dr = r - centers[k][0];
        const dg = g - centers[k][1];
        const db = b - centers[k][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          bestK = k;
        }
      }
      if (labels[i] !== bestK) {
        labels[i] = bestK;
        changed = true;
      }
      counts[bestK] += 1;
      sums[bestK * 3] += r;
      sums[bestK * 3 + 1] += g;
      sums[bestK * 3 + 2] += b;
    }

    for (let k = 0; k < 3; k++) {
      if (counts[k] > 0) {
        centers[k][0] = sums[k * 3] / counts[k];
        centers[k][1] = sums[k * 3 + 1] / counts[k];
        centers[k][2] = sums[k * 3 + 2] / counts[k];
      }
    }
    if (!changed) break;
  }

  let dominantK = 0;
  for (let k = 1; k < 3; k++) {
    if (counts[k] > counts[dominantK]) {
      dominantK = k;
    }
  }
  return centers[dominantK];
}

function classifyClassicCellRoi(
  pixels: Pixels,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  partyMode: boolean,
): ChestColor {
  const center = getRgb(pixels, ry + Math.floor(rh / 2), rx + Math.floor(rw / 2));
  const leftEdge = getRgb(pixels, ry + Math.floor(rh / 2), rx);

  if (colorDist(center, leftEdge) < COLOR_DIST_THRESHOLD) {
    return 'empty';
  }

  const dominant = dominantColorKMeans3(pixels, rx, ry, rw, rh);
  const palette = MODE_PALETTE[partyMode ? 'party' : 'normal'];

  let bestColor: ChestColor = 'empty';
  let bestDist = Infinity;
  for (const color of CHEST_COLORS) {
    if (color === 'empty') continue;
    const dist = colorDist(dominant, palette[color]);
    if (dist < bestDist) {
      bestDist = dist;
      bestColor = color;
    }
  }
  return bestColor;
}

export interface DetectedChest {
  index: number;
  value: ChestValue;
}

/**
 * Fast path for classic green/party PathTreasure theme using exact outer/inner frame colors.
 * Returns `null` when those theme-specific border colors are absent.
 */
function detectClassicBoard(
  pixels: Pixels,
  partyMode: boolean,
): DetectedChest[] | null {
  const { width: cols, height: rows } = pixels;

  let top = scanVertical(
    pixels,
    Math.round(0.5 * cols),
    0,
    rows - 1,
    BORDER_OUTER_RGB,
    true,
  );
  let bottom = scanVertical(
    pixels,
    Math.round(0.5 * cols),
    rows - 1,
    0,
    BORDER_OUTER_RGB,
    true,
  );
  if (top === undefined || bottom === undefined || bottom <= top) {
    return null;
  }

  const edgeInset = Math.min(20, Math.max(4, Math.round((bottom - top) * 0.02)));
  let left = scanHorizontal(
    pixels,
    top + edgeInset,
    Math.round(0.35 * cols),
    0,
    BORDER_OUTER_RGB,
    true,
  );
  let right = scanHorizontal(
    pixels,
    bottom - edgeInset,
    Math.round(0.65 * cols),
    cols - 1,
    BORDER_OUTER_RGB,
    true,
  );
  if (left === undefined || right === undefined || right <= left) {
    return null;
  }

  const midY = Math.round(top + (bottom - top) * 0.5);
  const midX = Math.round(left + (right - left) * 0.5);

  const innerLeft = scanHorizontal(
    pixels,
    midY,
    left,
    Math.round(left + 0.1 * cols),
    BORDER_INNER_RGB,
    true,
  );
  const innerRight = scanHorizontal(
    pixels,
    midY,
    right,
    Math.round(right - 0.1 * cols),
    BORDER_INNER_RGB,
    true,
  );
  if (innerLeft === undefined || innerRight === undefined) {
    return null;
  }
  left = innerLeft;
  right = innerRight;

  const firstGap = scanHorizontal(
    pixels,
    midY,
    Math.round(left + (right - left) / BOARD_COLS / 2),
    Math.round(left + 0.5 * cols),
    BORDER_INNER_RGB,
    true,
  );
  if (firstGap === undefined) {
    return null;
  }
  const cellW = firstGap - left;

  top =
    scanVertical(
      pixels,
      midX,
      top,
      Math.round(top + (bottom - top) * 0.1),
      BORDER_INNER_RGB,
      true,
    ) ?? top;
  bottom =
    scanVertical(
      pixels,
      midX,
      bottom,
      Math.round(bottom - (bottom - top) * 0.1),
      BORDER_INNER_RGB,
      true,
    ) ?? bottom;

  const aspect = (right - left) / Math.max(1, bottom - top);
  if (Math.abs(aspect - EXPECTED_ASPECT_RATIO) > ASPECT_TOLERANCE || cellW <= 0) {
    return null;
  }

  const gap = (right - left - BOARD_COLS * cellW) / (BOARD_COLS - 1);
  const cellH = (bottom - top - (BOARD_ROWS - 1) * gap) / BOARD_ROWS;

  const detected: DetectedChest[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (r === START_ROW && c === START_COL) continue;
      const cellX = left + c * (cellW + (c > 0 ? gap : 0));
      const cellY = top + r * (cellH + (r > 0 ? gap : 0));
      const rx = Math.round(cellX + 0.2 * cellW);
      const ry = Math.round(cellY + 0.25 * cellH);
      const rw = Math.max(1, Math.round(0.6 * cellW));
      const rh = Math.max(1, Math.round(0.5 * cellH));

      const color = classifyClassicCellRoi(pixels, rx, ry, rw, rh, partyMode);
      if (color !== 'empty') {
        detected.push({
          index: r * BOARD_COLS + c,
          value: CHEST_COLOR_TO_VALUE[color],
        });
      }
    }
  }

  return detected;
}

function localPeaks(profile: Float64Array, threshold: number): number[] {
  const peaks: number[] = [];
  for (let i = 2; i < profile.length - 2; i++) {
    if (
      profile[i] > threshold &&
      profile[i] >= profile[i - 1] &&
      profile[i] >= profile[i + 1]
    ) {
      peaks.push(i);
    }
  }
  return peaks;
}

function meanBandLumVertical(
  pixels: Pixels,
  col: number,
  yStart: number,
  yEnd: number,
): number {
  let sum = 0;
  let count = 0;
  const x0 = Math.max(0, col - 1);
  const x1 = Math.min(pixels.width - 1, col + 1);
  const step = Math.max(1, Math.floor((yEnd - yStart) / 48));
  for (let y = yStart; y < yEnd; y += step) {
    for (let x = x0; x <= x1; x++) {
      sum += getLum(pixels, y, x);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function meanBandLumHorizontal(
  pixels: Pixels,
  row: number,
  xStart: number,
  xEnd: number,
): number {
  let sum = 0;
  let count = 0;
  const y0 = Math.max(0, row - 1);
  const y1 = Math.min(pixels.height - 1, row + 1);
  const step = Math.max(1, Math.floor((xEnd - xStart) / 48));
  for (let x = xStart; x < xEnd; x += step) {
    for (let y = y0; y <= y1; y++) {
      sum += getLum(pixels, y, x);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function rowMeanLum(
  pixels: Pixels,
  row: number,
  xStart: number,
  xEnd: number,
): number {
  const r = Math.max(0, Math.min(pixels.height - 1, row));
  const step = Math.max(1, Math.floor((xEnd - xStart) / 64));
  let sum = 0;
  let count = 0;
  for (let x = xStart; x < xEnd; x += step) {
    sum += getLum(pixels, r, x);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function colMeanLum(
  pixels: Pixels,
  col: number,
  yStart: number,
  yEnd: number,
): number {
  const c = Math.max(0, Math.min(pixels.width - 1, col));
  const step = Math.max(1, Math.floor((yEnd - yStart) / 64));
  let sum = 0;
  let count = 0;
  for (let y = yStart; y < yEnd; y += step) {
    sum += getLum(pixels, y, c);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function refineDarkBorder(
  center: number,
  radius: number,
  measureLum: (pos: number) => number,
): number {
  let best = center;
  let minLum = Infinity;
  for (let d = -radius; d <= radius; d++) {
    const lum = measureLum(center + d);
    if (lum < minLum) {
      minLum = lum;
      best = center + d;
    }
  }
  return best;
}

function findAxialBoardRect(
  pixels: Pixels,
): { left: number; top: number; width: number; height: number } | null {
  const { width: w, height: h, data } = pixels;
  const peakRadius = Math.max(2, Math.round(w * 0.004));
  const vx = new Float64Array(w);
  const yMin = Math.round(h * 0.28);
  const yMax = Math.round(h * 0.78);
  const yRows = Math.max(1, yMax - yMin);

  for (let y = yMin; y < yMax; y++) {
    for (let x = 1; x < w; x++) {
      const idx = (y * w + x) * 4;
      const prev = idx - 4;
      vx[x] +=
        (Math.abs(data[idx] - data[prev]) +
          Math.abs(data[idx + 1] - data[prev + 1]) +
          Math.abs(data[idx + 2] - data[prev + 2])) /
        (3 * yRows);
    }
  }

  const xPeaks = localPeaks(vx, 8);
  let bestX: { score: number; left: number; span: number } | null = null;
  const minStepX = w * 0.06;
  const maxStepX = w * 0.16;

  for (let i = 0; i < xPeaks.length; i++) {
    for (let j = i + 1; j < xPeaks.length; j++) {
      const span = xPeaks[j] - xPeaks[i];
      const step = span / BOARD_COLS;
      if (step < minStepX || step > maxStepX) continue;

      let aligned = 0;
      let gapScore = 0;
      let borderScore = 0;
      for (let k = 0; k <= BOARD_COLS; k++) {
        const pos = xPeaks[i] + k * step;
        const pi = Math.round(pos);
        let peakMax = 0;
        for (let d = -peakRadius; d <= peakRadius; d++) {
          peakMax = Math.max(peakMax, vx[pi + d] ?? 0);
        }
        if (peakMax > 8) aligned += 1;

        const gLum = Math.min(
          colMeanLum(pixels, pi, yMin, yMax),
          colMeanLum(pixels, pi - 1, yMin, yMax),
          colMeanLum(pixels, pi + 1, yMin, yMax),
        );
        if (k > 0 && k < BOARD_COLS) {
          const lLum = meanBandLumVertical(
            pixels,
            Math.round(pos - step * 0.35),
            yMin,
            yMax,
          );
          const rLum = meanBandLumVertical(
            pixels,
            Math.round(pos + step * 0.35),
            yMin,
            yMax,
          );
          if (gLum + 10 < Math.min(lLum, rLum)) gapScore += 1;
        } else {
          const innerPos = k === 0 ? pos + step * 0.35 : pos - step * 0.35;
          if (gLum + 10 < meanBandLumVertical(pixels, Math.round(innerPos), yMin, yMax)) {
            borderScore += 1;
          }
        }
      }

      if (aligned >= BOARD_COLS) {
        const score = aligned + 3 * gapScore + 2 * borderScore;
        if (!bestX || score > bestX.score) {
          bestX = { score, left: xPeaks[i], span };
        }
      }
    }
  }

  if (!bestX) return null;
  const left = refineDarkBorder(bestX.left, peakRadius, (x) =>
    colMeanLum(pixels, x, yMin, yMax),
  );
  const right = Math.min(
    w - 1,
    refineDarkBorder(bestX.left + bestX.span, peakRadius, (x) =>
      colMeanLum(pixels, x, yMin, yMax),
    ),
  );
  const bw = right - left;
  if (bw <= 0) return null;
  const stepX = bw / BOARD_COLS;

  const hy = new Float64Array(h);
  const xSpan = Math.max(1, right - left);
  for (let y = 1; y < h; y++) {
    for (let x = left; x < right; x++) {
      const idx = (y * w + x) * 4;
      const up = idx - w * 4;
      hy[y] +=
        (Math.abs(data[idx] - data[up]) +
          Math.abs(data[idx + 1] - data[up + 1]) +
          Math.abs(data[idx + 2] - data[up + 2])) /
        (3 * xSpan);
    }
  }

  const yPeaks = localPeaks(hy, 8);
  let bestY: { score: number; top: number; span: number } | null = null;
  const minStepY = stepX * 0.85;
  const maxStepY = stepX * 1.15;
  const xInnerStart = Math.min(right - 1, left + 4);
  const xInnerEnd = Math.max(xInnerStart + 1, right - 4);

  for (let i = 0; i < yPeaks.length; i++) {
    for (let j = i + 1; j < yPeaks.length; j++) {
      const span = yPeaks[j] - yPeaks[i];
      const step = span / BOARD_ROWS;
      if (step < minStepY || step > maxStepY) continue;

      let aligned = 0;
      let gapScore = 0;

      for (let k = 0; k <= BOARD_ROWS; k++) {
        const pos = yPeaks[i] + k * step;
        const pi = Math.round(pos);
        let peakMax = 0;
        for (let d = -peakRadius; d <= peakRadius; d++) {
          peakMax = Math.max(peakMax, hy[pi + d] ?? 0);
        }
        if (peakMax > 8) aligned += 1;

        const gLum =
          k > 0 && k < BOARD_ROWS
            ? rowMeanLum(pixels, pi, xInnerStart, xInnerEnd)
            : Math.min(
              rowMeanLum(pixels, pi, xInnerStart, xInnerEnd),
              rowMeanLum(pixels, pi - 1, xInnerStart, xInnerEnd),
              rowMeanLum(pixels, pi + 1, xInnerStart, xInnerEnd),
            );
        const above =
          k > 0
            ? meanBandLumHorizontal(
              pixels,
              Math.round(pos - step * 0.35),
              xInnerStart,
              xInnerEnd,
            )
            : gLum + 30;
        const below =
          k < BOARD_ROWS
            ? meanBandLumHorizontal(
              pixels,
              Math.round(pos + step * 0.35),
              xInnerStart,
              xInnerEnd,
            )
            : gLum + 30;

        if (
          (k === 0 && gLum + 12 < below) ||
          (k === BOARD_ROWS && gLum + 12 < above) ||
          (k > 0 && k < BOARD_ROWS && gLum + 12 < Math.min(above, below))
        ) {
          gapScore += 1;
        }
      }

      if (aligned < BOARD_ROWS) continue;

      // Require internal column gaps inside each row so header/footer banners aren't mistaken for rows.
      let rowColGaps = 0;
      let endRowsOk = 0;
      for (let r = 0; r < BOARD_ROWS; r++) {
        const ry0 = Math.round(yPeaks[i] + (r + 0.25) * step);
        const ry1 = Math.round(yPeaks[i] + (r + 0.75) * step);
        const yStride = Math.max(1, Math.floor((ry1 - ry0) / 16));
        let colOk = 0;
        for (let c = 1; c < BOARD_COLS; c++) {
          const cx = Math.round(left + c * stepX);
          let cg = Infinity;
          for (let d = -1; d <= 1; d++) {
            const colX = Math.max(0, Math.min(w - 1, cx + d));
            let s = 0;
            let cnt = 0;
            for (let y = ry0; y < ry1; y += yStride) {
              s += getLum(pixels, y, colX);
              cnt += 1;
            }
            if (cnt > 0) cg = Math.min(cg, s / cnt);
          }
          const cl = Math.max(
            meanBandLumVertical(pixels, Math.round(left + (c - 0.8) * stepX), ry0, ry1),
            meanBandLumVertical(pixels, Math.round(left + (c - 0.2) * stepX), ry0, ry1),
          );
          const cr = Math.max(
            meanBandLumVertical(pixels, Math.round(left + (c + 0.2) * stepX), ry0, ry1),
            meanBandLumVertical(pixels, Math.round(left + (c + 0.8) * stepX), ry0, ry1),
          );
          if (cg + 12 < Math.min(cl, cr)) colOk += 1;
        }
        if (colOk >= 4) {
          rowColGaps += 1;
          if (r === 0 || r === BOARD_ROWS - 1) endRowsOk += 1;
        }
      }

      const score = aligned + 4 * gapScore + 2 * rowColGaps + 3 * endRowsOk;
      if (!bestY || score > bestY.score) {
        bestY = { score, top: yPeaks[i], span };
      }
    }
  }

  if (!bestY) return null;
  const top = refineDarkBorder(bestY.top, peakRadius, (y) =>
    rowMeanLum(pixels, y, xInnerStart, xInnerEnd),
  );
  const bottom = Math.min(
    h - 1,
    refineDarkBorder(bestY.top + bestY.span, peakRadius, (y) =>
      rowMeanLum(pixels, y, xInnerStart, xInnerEnd),
    ),
  );
  const bh = bottom - top;
  const aspect = bw / Math.max(1, bh);
  if (bh <= 0 || Math.abs(aspect - EXPECTED_ASPECT_RATIO) > ASPECT_TOLERANCE) {
    return null;
  }

  return {
    left,
    top,
    width: bw,
    height: bh,
  };
}

function roiMeanRgbStd(
  pixels: Pixels,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): number {
  const n = rw * rh;
  if (n <= 0) return 0;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const [r, g, b] = getRgb(pixels, y, x);
      sumR += r;
      sumG += g;
      sumB += b;
    }
  }
  const meanR = sumR / n;
  const meanG = sumG / n;
  const meanB = sumB / n;

  let varR = 0;
  let varG = 0;
  let varB = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const [r, g, b] = getRgb(pixels, y, x);
      varR += (r - meanR) ** 2;
      varG += (g - meanG) ** 2;
      varB += (b - meanB) ** 2;
    }
  }
  return (
    (Math.sqrt(varR / n) + Math.sqrt(varG / n) + Math.sqrt(varB / n)) / 3
  );
}

interface ThemedCellFeatures {
  index: number;
  isAdj: boolean;
  std: number;
  lid: Rgb;
  key: Rgb;
  sideBg: Rgb;
}

function sampleMeanRgb(
  pixels: Pixels,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minLum = 0,
): Rgb {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let brightCount = 0;
  let allR = 0;
  let allG = 0;
  let allB = 0;
  let allCount = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const [r, g, b] = getRgb(pixels, y, x);
      allR += r;
      allG += g;
      allB += b;
      allCount += 1;
      if (minLum <= 0 || (r + g + b) / 3 >= minLum) {
        sumR += r;
        sumG += g;
        sumB += b;
        brightCount += 1;
      }
    }
  }

  if (brightCount > 0) {
    return [sumR / brightCount, sumG / brightCount, sumB / brightCount];
  }
  const denom = Math.max(1, allCount);
  return [allR / denom, allG / denom, allB / denom];
}

function medianRgb(samples: readonly Rgb[]): Rgb {
  const pick = (channel: 0 | 1 | 2) => {
    const sorted = samples.map((s) => s[channel]).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return [pick(0), pick(1), pick(2)];
}

function extractThemedCellFeatures(
  pixels: Pixels,
  row: number,
  col: number,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
): ThemedCellFeatures {
  const rx = Math.round(cellX + 0.2 * cellW);
  const ry = Math.round(cellY + 0.25 * cellH);
  const rw = Math.max(1, Math.round(0.6 * cellW));
  const rh = Math.max(1, Math.round(0.5 * cellH));
  const std = roiMeanRgbStd(pixels, rx, ry, rw, rh);

  // Sample chest upper lid (avoids center keyhole) and ignore dark outlines (lum < 85).
  const ux0 = Math.round(cellX + 0.22 * cellW);
  const uy0 = Math.round(cellY + 0.16 * cellH);
  const ux1 = Math.max(ux0 + 1, Math.round(cellX + 0.78 * cellW));
  const uy1 = Math.max(uy0 + 1, Math.round(cellY + 0.42 * cellH));
  const lid = sampleMeanRgb(pixels, ux0, uy0, ux1, uy1, 85);

  // Sample center diamond keyhole to distinguish empty tiles from chests across bright/pink themes.
  const kx0 = Math.round(cellX + 0.43 * cellW);
  const ky0 = Math.round(cellY + 0.42 * cellH);
  const kx1 = Math.max(kx0 + 1, Math.round(cellX + 0.57 * cellW));
  const ky1 = Math.max(ky0 + 1, Math.round(cellY + 0.58 * cellH));
  const key = sampleMeanRgb(pixels, kx0, ky0, kx1, ky1);

  // Sample outer left tile margin (outside chest body) to measure hero-adjacent highlight tint.
  const bx0 = Math.round(cellX + 0.08 * cellW);
  const by0 = Math.round(cellY + 0.25 * cellH);
  const bx1 = Math.max(bx0 + 1, Math.round(cellX + 0.14 * cellW));
  const by1 = Math.max(by0 + 1, Math.round(cellY + 0.65 * cellH));
  const sideBg = sampleMeanRgb(pixels, bx0, by0, bx1, by1);

  return {
    index: row * BOARD_COLS + col,
    isAdj: Math.abs(row - START_ROW) + Math.abs(col - START_COL) === 1,
    std,
    lid,
    key,
    sideBg,
  };
}

function classifyThemedChestLid(lid: Rgb, emptyRef: Rgb | null): ChestColor {
  if (emptyRef && Math.min(emptyRef[0], emptyRef[1], emptyRef[2]) >= 55) {
    // Multiplicative white-balance against the board's empty tile color removes theme/party tints.
    const nr = lid[0] / emptyRef[0];
    const ng = lid[1] / emptyRef[1];
    const nb = lid[2] / emptyRef[2];
    if (ng - nr > 0.115) return 'green';
    if (nr - nb > 0.1) return 'red';
    return 'purple';
  }

  const [r, g, b] = lid;
  if (r - b > 24) return 'red';
  if (r - g > 62) return 'purple';
  return 'green';
}

/**
 * Universal theme-agnostic 9x7 detector supporting Magic Ladder (normal & party) and mobile/compressed screenshots.
 */
function detectUniversalAxialBoard(pixels: Pixels): DetectedChest[] | null {
  const rect = findAxialBoardRect(pixels);
  if (!rect) return null;

  const gap = Math.max(2, Math.round(rect.width * 0.008));
  const cellW = (rect.width - (BOARD_COLS - 1) * gap) / BOARD_COLS;
  const cellH = (rect.height - (BOARD_ROWS - 1) * gap) / BOARD_ROWS;

  const cells: ThemedCellFeatures[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (r === START_ROW && c === START_COL) continue;
      const cellX = rect.left + c * (cellW + gap);
      const cellY = rect.top + r * (cellH + gap);
      cells.push(extractThemedCellFeatures(pixels, r, c, cellX, cellY, cellW, cellH));
    }
  }

  const nonAdj = cells.filter((cell) => !cell.isAdj);
  const minNonAdjStd = Math.min(...nonAdj.map((cell) => cell.std));
  const emptyCutoff = minNonAdjStd < 18.5 ? Math.max(17.5, minNonAdjStd + 3) : 17;
  const seedEmpties = nonAdj.filter((cell) => cell.std <= emptyCutoff);

  const emptyLid =
    seedEmpties.length > 0 ? medianRgb(seedEmpties.map((cell) => cell.lid)) : null;
  const emptyKey =
    seedEmpties.length > 0 ? medianRgb(seedEmpties.map((cell) => cell.key)) : null;

  const adjEmpties = cells.filter(
    (cell) => cell.isAdj && cell.std <= emptyCutoff + 1,
  );
  let adjEmptyLid = emptyLid;
  if (adjEmpties.length > 0) {
    adjEmptyLid = medianRgb(adjEmpties.map((cell) => cell.lid));
  } else if (emptyLid) {
    const nonAdjSideBg = medianRgb(nonAdj.map((cell) => cell.sideBg));
    const adjSideBg = medianRgb(
      cells.filter((cell) => cell.isAdj).map((cell) => cell.sideBg),
    );
    if (colorDist(adjSideBg, nonAdjSideBg) > 15) {
      adjEmptyLid = [
        emptyLid[0] + 0.5 * (adjSideBg[0] - nonAdjSideBg[0]),
        emptyLid[1] + 0.5 * (adjSideBg[1] - nonAdjSideBg[1]),
        emptyLid[2] + 0.5 * (adjSideBg[2] - nonAdjSideBg[2]),
      ];
    }
  }

  const detected: DetectedChest[] = [];
  for (const cell of cells) {
    const keyDist = emptyKey ? colorDist(cell.key, emptyKey) : Infinity;
    const isEmpty = cell.std < 19.5 && (!emptyKey || keyDist < 54);
    if (isEmpty) continue;

    const color = classifyThemedChestLid(
      cell.lid,
      cell.isAdj ? adjEmptyLid : emptyLid,
    );
    if (color !== 'empty') {
      detected.push({
        index: cell.index,
        value: CHEST_COLOR_TO_VALUE[color],
      });
    }
  }

  return detected;
}

/**
 * Detects the 9x7 Treasure Hunt board from a game screenshot and classifies each chest cell.
 * Supports both classic green/party PathTreasure boards and Magic Ladder themed boards.
 */
export function detectTreasureBoardFromPixels(
  pixels: Pixels,
  partyMode: boolean,
): DetectedChest[] {
  const { width: cols, height: rows } = pixels;
  if (cols < 70 || rows < 90) {
    throw new Error('图片尺寸过小，无法识别寻宝棋盘');
  }

  const classic = detectClassicBoard(pixels, partyMode);
  if (classic) return classic;

  const axial = detectUniversalAxialBoard(pixels);
  if (axial) return axial;

  throw new Error('未检测到寻宝棋盘，请确认截图包含完整的 9×7 寻宝盘面');
}
