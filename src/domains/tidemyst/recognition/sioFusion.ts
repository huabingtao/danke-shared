import type { RecognitionCell } from './pixels';
import type { Pixels, Rect } from './pixels';

interface GlyphShapeEntry {
  digit: number;
  shape: string;
}

const RAW_GLYPH_SHAPES: GlyphShapeEntry[] = [
  { digit: 2, shape: '000000000000003899996200038999999620059999999950035333899963000000599975000000699950000015999830000169998300001699983000005999950000668999953333999999999999999999999999999999999975000000000000' },
  { digit: 2, shape: '000000000000005999996200038999999620059999999963025433899999000000599999000000699963000015999830000169999400002699984100028999950000689999954333999999999999999999999999579999999975000000000000' },
  { digit: 3, shape: '000000000000005999965200038999999620059999999960024334899990000000699990001566899960003999999720003999999830001334899980000000599990023333699990089999999990089999999850079999985300000000000000' },
  { digit: 2, shape: '000000000000003899985200038999999620059999999963025433899999000000599999000000699986000015999830000059999500001589996100005999962000358999953333999999999999999999999999999999999999000000000000' },
  { digit: 3, shape: '000000000000005999852000038999998520059999999960025534899990000000699990001335899960003999999720003999999850001346899990000000699990023333799990069999999990059999999850059999997300000000000000' },
  { digit: 4, shape: '000000000000000003899820000017999930000059999930001589999930003999999930016998899930049994699930689984799943999999999989999999999999999999999999356665899963000000699930000000699930000000000000' },
  { digit: 0, shape: '000000000000000389983000026899998510049986689950069960059985069940039999069930039999589930039999999930039999379930039999069940039973069982059960049998689940015799998510000255753000000000000000' },
  { digit: 1, shape: '000000000000002556999700008999999900009999999900009868999900005206999900000006999900000006999900000006999900000006999900000006999900000005999900000003999900000005999900000005999700000000000000' },
  { digit: 4, shape: '000000000000000027999600000049999600000179999600001699999600003999999600016998999600049962999600689953999720999999999960999999999960999999999973344335999830000000999600000000799600000000000000' },
  { digit: 1, shape: '000000699500000035899700003689999900005999999900006867999900002203999900000003999900000003999900000003999900000003999900000003999900000003999900000003999900000003999900000002899900000000000000' },
  { digit: 5, shape: '003999999300005999999500027999999600059999999600059996333300059993000000089997653100099999999620099879999950033214899980000000699990033334899980099999999950099999998520079999962000000000000000' },
  { digit: 6, shape: '000000596000000025798200000379999300003899999300027999653100059997000000689998665200999999999853999998899999999962259999999950039999999973269999369999899986026999999830002699998300000000000000' },
  { digit: 0, shape: '000000000000000599996200015899999820049986689950069960059960379940039986999930039999999930039999999930039999999930039999379940049973069985589960049999999950015899998510000355763000000000000000' },
  { digit: 5, shape: '000000000000006999999600038999999600059998767500059995202200069995320000099999986300099999999820099999999950033333799980000001799990055556999970099999999950099999999620099999975200000000000000' },
  { digit: 3, shape: '000000000000079999996200099999999830088666999980022000999990000002999980003668999830005999999500005999999970002335999990000000899990055555999990099999999990099999999850099999996200000000000000' },
  { digit: 2, shape: '000000000000059999998520069999999950069999999960035555799985000000599986000000699960000002999960000059999720000389996200036899961000589999965555999999999999999999999999999999999999000000000000' },
  { digit: 1, shape: '000000000000005699999900009999999900009999999900009976999900003323999900000003999900000003999900000003999900000003999900000003999900000003999900000003999900000003999900000003999900000000000000' },
  { digit: 7, shape: '0000000000000999999999800999999999920999999999920344445999900000006999700000399982000007999500000039997000000799930000029998000000599950000007999200000099970000000899500000000000000000' },
  { digit: 8, shape: '000000000000005999996200049999999820089951049960099800019980089951159960039998899930006999999500028999999810089961059980099800009990099800009990089951149980049999999950006999999610000000000000' },
];

export function zScoreNormalize(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const centered = values.map((v) => v - mean);
  const norm = Math.sqrt(centered.reduce((acc, v) => acc + v * v, 0)) || 1;
  return centered.map((v) => v / norm);
}

const ZSCORE_TEMPLATES = RAW_GLYPH_SHAPES.map(({ digit, shape }) => ({
  digit,
  vec: zScoreNormalize(
    Array.from({ length: shape.length }, (_, i) => (shape.charCodeAt(i) - 48) / 9),
  ),
}));

const isClosedPixel = (r: number, g: number, b: number) => r < 70 && g > 95 && g < 200 && b > 175;
const isLightPixel = (r: number, g: number, b: number) => r > 105 && g > 195 && b > 215;
const isGemPixel = (r: number, g: number, b: number) => r > 190 && g > 110 && g < 215 && b < 110;
const isOpenedPixel = (r: number, g: number, b: number) => r < 55 && g > 45 && g < 105 && b > 100 && b < 170;
const isInkPixel = (r: number, g: number, b: number) =>
  Math.min(r, g, b) >= 60 && Math.max(r, g, b) - Math.min(r, g, b) <= 55;

const DIRS_8: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];
const DIRS_4: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function floodFill(
  start: number,
  width: number,
  height: number,
  dirs: [number, number][],
  predicate: (idx: number) => boolean,
): number[] {
  const stack = [start];
  const component = [start];
  const seen = new Set<number>(stack);
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (!seen.has(next) && predicate(next)) {
        seen.add(next);
        stack.push(next);
        component.push(next);
      }
    }
  }
  return component;
}

function countTopologicalHoles(
  mask: Uint8Array,
  width: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): number {
  const { minX, maxX, minY, maxY } = bounds;
  const paddedW = maxX - minX + 3;
  const paddedH = maxY - minY + 3;
  const padded = new Uint8Array(paddedW * paddedH);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * width + x]) {
        padded[(y - minY + 1) * paddedW + (x - minX + 1)] = 1;
      }
    }
  }
  const visited = new Uint8Array(paddedW * paddedH);
  let holes = 0;
  for (let i = 0; i < padded.length; i++) {
    if (padded[i] || visited[i]) continue;
    const region = floodFill(i, paddedW, paddedH, DIRS_4, (idx) => !padded[idx]);
    for (const idx of region) visited[idx] = 1;
    const touchesBorder = region.some(
      (idx) =>
        idx % paddedW === 0 ||
        Math.floor(idx / paddedW) === 0 ||
        idx % paddedW === paddedW - 1 ||
        Math.floor(idx / paddedW) === paddedH - 1,
    );
    if (!touchesBorder) holes += 1;
  }
  return holes;
}

/**
 * Fast 12x16 Z-score cosine similarity + topological hole count + in-game flag classifier.
 * Returns null if the cell is ambiguous and should fall back to template/Tesseract OCR.
 */
export function classifyTidemystCellZScore(crop: Pixels): RecognitionCell | null {
  const { width, height, data } = crop;
  const padX = Math.floor(width * 0.19);
  const padY = Math.floor(height * 0.19);
  let total = 0;
  let closed = 0;
  let light = 0;
  let gem = 0;
  let opened = 0;
  let ink = 0;

  for (let y = padY; y < height - padY; y++) {
    for (let x = padX; x < width - padX; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      total += 1;
      if (isInkPixel(r, g, b)) ink += 1;
      if (isGemPixel(r, g, b)) gem += 1;
      else if (isLightPixel(r, g, b)) light += 1;
      else if (isClosedPixel(r, g, b)) closed += 1;
      else if (isOpenedPixel(r, g, b)) opened += 1;
    }
  }

  const denom = Math.max(total, 1);
  const ratios = {
    closed: closed / denom,
    light: light / denom,
    gem: gem / denom,
    opened: opened / denom,
    ink: ink / denom,
  };

  if (ratios.gem >= 0.05) {
    return {
      cell: { observed: 'gem', flagged: false },
      confidence: 0.96,
      reason: '检测到金色宝石高光',
      needsReview: false,
    };
  }
  if (ratios.light >= 0.15 && ratios.closed >= 0.08) {
    return {
      cell: { observed: 'unknown', flagged: true },
      confidence: 0.92,
      reason: '检测到游戏内旗帜标记',
      needsReview: false,
    };
  }
  if (ratios.closed >= 0.3) {
    return {
      cell: { observed: 'unknown', flagged: false },
      confidence: 0.94,
      reason: '未开启青蓝矿石格',
      needsReview: false,
    };
  }
  if (ratios.opened >= 0.3 && ratios.ink < 0.02) {
    return {
      cell: { observed: 0, flagged: false },
      confidence: 0.93,
      reason: '已开启空地（数字 0）',
      needsReview: false,
    };
  }
  if (ratios.opened < 0.3) return null;

  const mx = Math.floor(width * 0.1);
  const my = Math.floor(height * 0.1);
  const cw = Math.max(1, width - 2 * mx);
  const ch = Math.max(1, height - 2 * my);
  const rawMask = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const idx = ((my + y) * width + (mx + x)) * 4;
      rawMask[y * cw + x] = isInkPixel(data[idx], data[idx + 1], data[idx + 2]) ? 1 : 0;
    }
  }

  const seen = new Uint8Array(cw * ch);
  const cleanMask = new Uint8Array(cw * ch);
  for (let i = 0; i < rawMask.length; i++) {
    if (!rawMask[i] || seen[i]) continue;
    const comp = floodFill(i, cw, ch, DIRS_8, (idx) => rawMask[idx] === 1);
    for (const idx of comp) seen[idx] = 1;
    if (comp.length >= 10) {
      for (const idx of comp) cleanMask[idx] = 1;
    }
  }

  const active = Array.from(cleanMask.keys()).filter((i) => cleanMask[i] === 1);
  if (active.length < 12) return null;

  let minX = cw;
  let maxX = -1;
  let minY = ch;
  let maxY = -1;
  for (const idx of active) {
    const x = idx % cw;
    const y = Math.floor(idx / cw);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const scale = Math.min(14 / bh, 11 / bw);
  const offX = (12 - bw * scale) / 2;
  const offY = (16 - bh * scale) / 2;

  const vec = zScoreNormalize(
    Array.from({ length: 192 }, (_, k) => {
      const gx = k % 12;
      const gy = Math.floor(k / 12);
      const sx0 = Math.max(minX, Math.floor(minX + (gx - offX) / scale));
      const sx1 = Math.min(maxX, Math.ceil(minX + (gx + 1 - offX) / scale) - 1);
      const sy0 = Math.max(minY, Math.floor(minY + (gy - offY) / scale));
      const sy1 = Math.min(maxY, Math.ceil(minY + (gy + 1 - offY) / scale) - 1);
      if (sx1 < sx0 || sy1 < sy0) return 0;
      let sum = 0;
      for (let y = sy0; y <= sy1; y++) {
        for (let x = sx0; x <= sx1; x++) sum += cleanMask[y * cw + x];
      }
      return sum / ((sx1 - sx0 + 1) * (sy1 - sy0 + 1));
    }),
  );

  const bestByDigit = new Map<number, number>();
  for (const tpl of ZSCORE_TEMPLATES) {
    let dot = 0;
    for (let i = 0; i < 192; i++) dot += tpl.vec[i] * vec[i];
    if (dot > (bestByDigit.get(tpl.digit) ?? -Infinity)) {
      bestByDigit.set(tpl.digit, dot);
    }
  }
  const ranked = [...bestByDigit.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const margin = second ? top[1] - second[1] : 1;

  // Dual closed loops strongly support digit 8 only when template similarity agrees
  // (prevents JPEG artifacts in digit 4 from being forced to 8).
  const holes = countTopologicalHoles(cleanMask, cw, { minX, maxX, minY, maxY });
  const score8 = bestByDigit.get(8) ?? -Infinity;
  if (holes === 2 && top && score8 >= 0.72 && score8 >= top[1] - 0.06) {
    return {
      cell: { observed: 8, flagged: false },
      confidence: Math.max(0.92, Math.min(0.98, score8)),
      reason: '双孔洞拓扑与模板匹配为数字 8',
      needsReview: false,
    };
  }

  if (top && top[1] >= 0.8 && margin >= 0.04) {
    return {
      cell: { observed: top[0], flagged: false },
      confidence: Math.min(0.98, top[1]),
      reason: `Z-Score 余弦相似度匹配数字 ${top[0]}`,
      needsReview: false,
    };
  }
  return null;
}

export function extractRoomNumberCrop(image: Pixels, rect: Rect): Pixels | null {
  const span = rect.width;
  const x0 = Math.max(0, Math.round(rect.x + 0.45 * span));
  const y0 = Math.round(rect.y - 0.17 * span);
  const w = Math.min(image.width - x0, Math.round(0.4 * span));
  const h = Math.round(0.1 * span);
  if (y0 < 0 || w <= 8 || h <= 6 || y0 + h > image.height) return null;

  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = ((y0 + y) * image.width + (x0 + x)) * 4;
      const dstIdx = (y * w + x) * 4;
      const bright =
        Math.min(image.data[srcIdx], image.data[srcIdx + 1], image.data[srcIdx + 2]) > 200;
      const v = bright ? 0 : 255;
      data[dstIdx] = v;
      data[dstIdx + 1] = v;
      data[dstIdx + 2] = v;
      data[dstIdx + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

export function parseRoomNumberText(text: string, expectedSize: number): string | null {
  const match = /(\d+)\s*[(（]\s*(\d+)\s*[xX×хХ]/.exec(text);
  if (!match) return null;
  if (Number(match[2]) !== expectedSize) return null;
  return match[1];
}
