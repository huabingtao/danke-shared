import { describe, expect, it } from 'vitest';
import { formatGemValue, gemGroups, parseGemCatalog } from '../src/domains/gem';
import { acquisitionResources, formatAcquisitionTotal, parseAcquisitionSnapshot } from '../src/domains/acquisition';
import { CELL_COUNT, START_INDEX, createEmptyBoard, solveTreasurePath } from '../src/domains/treasure-hunt';
import { DEFAULT_GEMS, recommend, solveBoard, type Board } from '../src/domains/tidemyst';
import { computeCycleState, getReminderCycleKey } from '../src/domains/reminder';
import { recognizeTidemystBoardFromPixels } from '../src/domains/tidemyst/recognition';
import { detectTreasureBoardFromPixels } from '../src/domains/treasure-hunt/detector';
import { isOrangeBatchScore, normalizeTimeWithSeconds } from '../src/domains/rank';
import { RANCH_CROP_CONFIGS, validateRanchEntryInput } from '../src/domains/ranch';
import { cumulativeMountCosts, intervalCosts } from '../src/domains/upgrades';

describe('danke-shared domain modules', () => {
  it('parses gem catalog and groups items', () => {
    const catalog = parseGemCatalog(
      { categories: [{ id: 'core', name: '核心', sortOrder: 1 }] },
      [
        {
          id: 'refine_core',
          name: '神铸核心',
          icon: '/a.png',
          categoryIds: ['core'],
          gemValuation: { prices: [{ id: 'default', label: '默认单价', value: 1200 }] },
        },
      ],
      (v) => (typeof v === 'string' ? v : null),
      () => null,
    );
    expect(catalog.items).toHaveLength(1);
    expect(gemGroups(catalog)[0].items[0].name).toBe('神铸核心');
    expect(formatGemValue(1200)).toBe('1,200');
  });

  it('parses acquisition snapshot and aggregates totals', () => {
    const catalog = parseGemCatalog(
      { categories: [{ id: 'core', name: '核心' }] },
      [{ id: 'gem', name: '宝石', categoryIds: ['core'], gemValuation: { prices: [] } }],
      () => null,
      () => null,
    );
    const snapshot = parseAcquisitionSnapshot(
      catalog,
      [{ id: 's1', name: '日常任务' }],
      [{ id: 'r1', itemId: 'gem', sourceId: 's1', amount: 100.5, year: 2026, month: 11 }],
    );
    const resources = acquisitionResources(snapshot);
    expect(resources).toHaveLength(1);
    expect(formatAcquisitionTotal(resources[0].offers)).toBe('100.5');
  });

  it('solves optimal 15-step treasure hunt path', () => {
    const board = createEmptyBoard();
    expect(board).toHaveLength(CELL_COUNT);
    board[START_INDEX - 1].value = 50; // left of start
    board[START_INDEX - 2].value = 20;
    const result = solveTreasurePath(board);
    expect(result.profit).toBe(70);
    expect(result.steps).toHaveLength(16);
  });

  it('solves tidemyst board and generates recommendations', () => {
    const size = 8;
    const board: Board = {
      id: 'b1',
      room: '1',
      size,
      totalGems: DEFAULT_GEMS[size],
      cells: Array.from({ length: size * size }, () => ({ observed: 'unknown' as const, flagged: false })),
      updatedAt: 0,
    };
    board.cells[0] = { observed: 1, flagged: false };
    board.cells[1] = { observed: 'safe', flagged: false };
    board.cells[size] = { observed: 'safe', flagged: false };

    const solved = solveBoard(board);
    expect(solved.status).toBe('exact');
    expect(solved.probabilities[size + 1]).toBe(1);
    const rec = recommend(board, solved);
    expect(rec.next).toContain(size + 1);
  });

  it('computes reminder cycle state and stable cycleKey', () => {
    const state = computeCycleState(
      { startDate: '2026-11-01', durationDays: 5, cycleDays: 7, hasRedeemDay: true },
      new Date(2026, 10, 6), // day 5 -> redeem day
    );
    expect(state.computedStatus).toBe('REDEEM');
    expect(state.daysRemaining).toBe(1);

    const key1 = getReminderCycleKey(
      { ruleType: 'CYCLE', startDate: '2026-11-01', durationDays: 5, cycleDays: 7 },
      new Date('2026-11-02T12:00:00Z'),
    );
    const key2 = getReminderCycleKey(
      { ruleType: 'CYCLE', startDate: '2026-11-01', durationDays: 5, cycleDays: 7 },
      new Date('2026-11-09T12:00:00Z'),
    );
    expect(key1).toBe('cycle:0');
    expect(key2).toBe('cycle:1');
  });

  it('exposes pure pixel recognition entrypoints', () => {
    const blank = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4) };
    const tide = recognizeTidemystBoardFromPixels(blank, 8);
    expect(tide.grid.size).toBe(8);
    expect(tide.cells).toHaveLength(64);
    expect(() => detectTreasureBoardFromPixels(blank, false)).toThrow();
  });

  it('validates rank, ranch, and upgrades domain helpers', () => {
    expect(isOrangeBatchScore(67)).toBe(true);
    expect(normalizeTimeWithSeconds('20:30')).toBe('20:30:00');

    const ok = validateRanchEntryInput('egg', '123456', String(RANCH_CROP_CONFIGS.egg.max));
    expect(ok.ok).toBe(true);

    expect(
      intervalCosts(
        [{ id: 1, threshold: 1, costs: { '11000': 10 }, effect: 'e', sourceId: 's' }],
        0,
        1,
      ),
    ).toEqual({ '11000': 10 });
    expect(
      cumulativeMountCosts([{ star: 0, costs: { frag: 5 }, sourceId: 's' }], 0),
    ).toEqual({ frag: 5 });
  });
});
