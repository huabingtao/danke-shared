import { neighbors, type Board, type SolveResult } from './models';

interface Constraint {
  vars: number[];
  target: number;
  sources: number[];
}

interface Component {
  vars: number[];
  constraints: Constraint[];
}

interface Counts {
  ways: bigint[];
  hits: Map<number, bigint[]>;
}

export interface SolveOptions {
  maxNodes?: number;
  maxMs?: number;
}

export function choose(n: number, k: number): bigint {
  if (k < 0 || k > n) return BigInt(0);
  k = Math.min(k, n - k);
  let count = BigInt(1);
  for (let i = 1; i <= k; i++) count = (count * BigInt(n - i + 1)) / BigInt(i);
  return count;
}

function convolve(a: bigint[], b: bigint[], cap: number): bigint[] {
  const result = Array<bigint>(Math.min(cap + 1, a.length + b.length - 1)).fill(
    BigInt(0),
  );
  for (let i = 0; i < a.length; i++) {
    if (!a[i]) continue;
    for (let j = 0; j < b.length && i + j <= cap; j++) {
      if (b[j]) result[i + j] += a[i] * b[j];
    }
  }
  return result;
}

function ratio(a: bigint, b: bigint): number {
  if (a === BigInt(0)) return 0;
  if (a === b) return 1;
  return Math.max(
    Number.EPSILON,
    Math.min(
      1 - Number.EPSILON,
      Number((a * BigInt(1000000000000000)) / b) / 1000000000000000,
    ),
  );
}

function findRiskyFlags(
  board: Board,
  probabilities: (number | null)[],
): number[] {
  const risky: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    const cell = board.cells[i];
    if (!cell.flagged || cell.observed !== 'unknown') continue;
    const prob = probabilities[i];
    if (prob === null || prob <= 0) continue;
    if (
      neighbors(i, board.size).some(
        (n) => typeof board.cells[n].observed === 'number',
      )
    ) {
      risky.push(i);
    }
  }
  return risky;
}

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Exact probability solver fusing iterative subset-difference reduction,
 * BigInt polynomial convolution, and Int32Array + frontier state memoization.
 */
export function solveBoard(
  board: Board,
  options: SolveOptions = {},
): SolveResult {
  const started = nowMs();
  const { size, cells, totalGems } = board;
  const probabilities: (number | null)[] = cells.map((c) =>
    c.observed === 'gem' ? 1 : c.observed === 'unknown' ? null : 0,
  );
  const found = cells.filter((c) => c.observed === 'gem').length;
  const remaining = totalGems - found;
  let nodes = 0;

  const result = (
    status: SolveResult['status'],
    message: string,
    conflictCells: number[] = [],
    layouts = '0',
    riskyFlags: number[] = [],
  ): SolveResult => ({
    status,
    message,
    conflictCells,
    riskyFlags,
    probabilities:
      status === 'exact' ? probabilities : Array(cells.length).fill(null),
    remaining,
    layouts,
    nodes,
    elapsedMs: nowMs() - started,
  });

  if (
    !Number.isInteger(size) ||
    size < 1 ||
    cells.length !== size * size ||
    !Number.isInteger(totalGems) ||
    totalGems < 0 ||
    totalGems > cells.length
  ) {
    return result('conflict', '棋盘尺寸或宝石总数无效');
  }

  const unknown = cells.flatMap((c, i) =>
    c.observed === 'unknown' ? [i] : [],
  );
  if (remaining < 0 || remaining > unknown.length) {
    return result(
      'conflict',
      '宝石总数与已发现宝石、可用未知格子数量矛盾',
      cells.flatMap((c, i) => (c.observed === 'gem' ? [i] : [])),
    );
  }

  let constraints: Constraint[] = [];
  for (let i = 0; i < cells.length; i++) {
    const o = cells[i].observed;
    if (typeof o !== 'number') continue;
    const ns = neighbors(i, size);
    constraints.push({
      vars: ns.filter((n) => cells[n].observed === 'unknown'),
      target: o - ns.filter((n) => cells[n].observed === 'gem').length,
      sources: [i],
    });
  }

  const fixed = new Map<number, number>();
  const canonical = (list: Constraint[]): Constraint[] | number[] => {
    const seen = new Map<string, Constraint>();
    for (const c of list) {
      const vars = c.vars.filter((v) => !fixed.has(v)).sort((a, b) => a - b);
      const target =
        c.target - c.vars.reduce((sum, v) => sum + (fixed.get(v) ?? 0), 0);
      if (target < 0 || target > vars.length) return c.sources;
      if (!vars.length) continue;
      const key = vars.join(',');
      const previous = seen.get(key);
      if (previous && previous.target !== target) {
        return [...previous.sources, ...c.sources];
      }
      seen.set(key, { vars, target, sources: c.sources });
    }
    return [...seen.values()];
  };

  for (let iteration = 0; iteration < cells.length + 1; iteration++) {
    const normalized = canonical(constraints);
    if (normalized.length && typeof normalized[0] === 'number') {
      return result(
        'conflict',
        '相邻数字或宝石标记互相矛盾',
        normalized as number[],
      );
    }
    constraints = normalized as Constraint[];
    let changed = false;
    for (const c of constraints) {
      if (c.target === 0 || c.target === c.vars.length) {
        for (const v of c.vars) {
          fixed.set(v, c.target === 0 ? 0 : 1);
          changed = true;
        }
      }
    }
    const left = remaining - [...fixed.values()].reduce((a, b) => a + b, 0);
    const free = unknown.filter((v) => !fixed.has(v));
    if (left < 0 || left > free.length) {
      return result(
        'conflict',
        '局部线索与全局宝石总数矛盾',
        constraints.flatMap((c) => c.sources),
      );
    }
    if (free.length && (left === 0 || left === free.length)) {
      for (const v of free) fixed.set(v, left === 0 ? 0 : 1);
      changed = true;
    }
    if (changed) continue;
    const additions: Constraint[] = [];
    const keys = new Set(constraints.map((c) => c.vars.join(',')));
    for (const a of constraints) {
      for (const b of constraints) {
        if (
          a.vars.length < b.vars.length &&
          a.vars.every((v) => b.vars.includes(v))
        ) {
          const vars = b.vars.filter((v) => !a.vars.includes(v));
          const target = b.target - a.target;
          if (target < 0 || target > vars.length) {
            return result('conflict', '共享数字线索无法同时成立', [
              ...a.sources,
              ...b.sources,
            ]);
          }
          const key = vars.join(',');
          if (!keys.has(key)) {
            additions.push({
              vars,
              target,
              sources: [...a.sources, ...b.sources],
            });
            keys.add(key);
          }
        }
      }
    }
    if (!additions.length) break;
    constraints.push(...additions);
  }

  const reduced = canonical(constraints);
  if (reduced.length && typeof reduced[0] === 'number') {
    return result('conflict', '线索冲突', reduced as number[]);
  }
  constraints = reduced as Constraint[];
  for (const [v, p] of fixed) probabilities[v] = p;

  const left = remaining - [...fixed.values()].reduce((a, b) => a + b, 0);
  const active = unknown.filter((v) => !fixed.has(v));
  const frontier = new Set(constraints.flatMap((c) => c.vars));
  const outside = active.filter((v) => !frontier.has(v));

  const memberships = new Map<number, Constraint[]>();
  for (const c of constraints) {
    for (const v of c.vars) {
      memberships.set(v, [...(memberships.get(v) ?? []), c]);
    }
  }

  const components: Component[] = [];
  const visited = new Set<number>();
  for (const v of frontier) {
    if (visited.has(v)) continue;
    const queue = [v];
    const vars: number[] = [];
    const cs = new Set<Constraint>();
    visited.add(v);
    for (let q = 0; q < queue.length; q++) {
      const n = queue[q];
      vars.push(n);
      for (const c of memberships.get(n) ?? []) {
        cs.add(c);
        for (const next of c.vars) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }
    }
    components.push({ vars, constraints: [...cs] });
  }

  const maxNodes = options.maxNodes ?? 2000000;
  const maxMs = options.maxMs ?? 5000;
  class BudgetExceeded extends Error {}

  function enumerate(component: Component): Counts {
    const cs = component.constraints;
    const groupsByRefs = new Map<string, { vars: number[]; refs: number[] }>();
    for (const v of component.vars) {
      const refs = cs.flatMap((c, i) => (c.vars.includes(v) ? [i] : []));
      const key = refs.join(',');
      const group = groupsByRefs.get(key);
      if (group) group.vars.push(v);
      else groupsByRefs.set(key, { vars: [v], refs });
    }

    const groups = [...groupsByRefs.values()].sort(
      (a, b) => b.refs.length - a.refs.length || b.vars.length - a.vars.length,
    );

    const numGroups = groups.length;
    const numConstraints = cs.length;
    const maxVars = component.vars.length;

    const groupSizes = Int32Array.from(groups, (g) => g.vars.length);
    const groupRefs = groups.map((g) => Int32Array.from(g.refs));
    const targets = Int32Array.from(cs, (c) => c.target);
    const sums = new Int32Array(numConstraints);
    const unassigned = Int32Array.from(cs, (c) => c.vars.length);
    const assigned = new Int32Array(numGroups);

    // Precompute active frontier constraints per depth for state dead-end memoization.
    const lastDepthForConstraint = new Int32Array(numConstraints).fill(-1);
    const firstDepthForConstraint = new Int32Array(numConstraints).fill(numGroups);
    for (let d = 0; d < numGroups; d++) {
      const refs = groupRefs[d];
      for (let r = 0; r < refs.length; r++) {
        const ci = refs[r];
        if (d < firstDepthForConstraint[ci]) firstDepthForConstraint[ci] = d;
        if (d > lastDepthForConstraint[ci]) lastDepthForConstraint[ci] = d;
      }
    }
    const activeAtDepth: Int32Array[] = Array.from({ length: numGroups + 1 }, (_, d) => {
      const activeIds: number[] = [];
      for (let ci = 0; ci < numConstraints; ci++) {
        if (firstDepthForConstraint[ci] < d && lastDepthForConstraint[ci] >= d) {
          activeIds.push(ci);
        }
      }
      return Int32Array.from(activeIds);
    });
    const deadStates = new Set<string>();

    const ways = Array<bigint>(maxVars + 1).fill(BigInt(0));
    const groupHits = groups.map(() => Array<bigint>(maxVars + 1).fill(BigInt(0)));
    const choices = groups.map((group) =>
      Array.from({ length: group.vars.length + 1 }, (_, k) =>
        choose(group.vars.length, k),
      ),
    );

    function makeStateKey(depth: number, count: number): string {
      const act = activeAtDepth[depth];
      let key = `${depth}:${count}`;
      for (let i = 0; i < act.length; i++) {
        const ci = act[i];
        key += `|${targets[ci] - sums[ci]}`;
      }
      return key;
    }

    function visit(depth: number, count: number, weight: bigint): boolean {
      nodes++;
      if (
        nodes > maxNodes ||
        (nodes % 512 === 0 && nowMs() - started > maxMs)
      ) {
        throw new BudgetExceeded();
      }
      if (count > left) return false;
      if (depth === numGroups) {
        ways[count] += weight;
        for (let i = 0; i < numGroups; i++) {
          if (assigned[i]) {
            groupHits[i][count] +=
              (weight * BigInt(assigned[i])) / BigInt(groupSizes[i]);
          }
        }
        return true;
      }

      const stateKey =
        activeAtDepth[depth].length <= 8 ? makeStateKey(depth, count) : '';
      if (stateKey && deadStates.has(stateKey)) return false;

      const n = groupSizes[depth];
      const refs = groupRefs[depth];
      let minimum = 0;
      let maximum = Math.min(n, left - count);
      for (let r = 0; r < refs.length; r++) {
        const ci = refs[r];
        const need = targets[ci] - sums[ci];
        const rest = unassigned[ci] - n;
        if (need - rest > minimum) minimum = need - rest;
        if (need < maximum) maximum = need;
      }

      let foundAny = false;
      for (let k = minimum; k <= maximum; k++) {
        for (let r = 0; r < refs.length; r++) {
          const ci = refs[r];
          sums[ci] += k;
          unassigned[ci] -= n;
        }
        assigned[depth] = k;
        if (visit(depth + 1, count + k, weight * choices[depth][k])) {
          foundAny = true;
        }
        for (let r = 0; r < refs.length; r++) {
          const ci = refs[r];
          sums[ci] -= k;
          unassigned[ci] += n;
        }
      }
      assigned[depth] = 0;
      if (!foundAny && stateKey) deadStates.add(stateKey);
      return foundAny;
    }

    visit(0, 0, BigInt(1));
    const hits = new Map<number, bigint[]>();
    groups.forEach((group, i) => {
      for (const v of group.vars) hits.set(v, groupHits[i]);
    });
    return { ways, hits };
  }

  let counts: Counts[];
  try {
    counts = components.map(enumerate);
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      return result(
        'limited',
        '精确枚举超出计算预算；请补充线索后重算。未输出截断概率。',
      );
    }
    throw e;
  }

  const freeWays = Array.from(
    { length: Math.min(outside.length, left) + 1 },
    (_, k) => choose(outside.length, k),
  );
  const prefix: bigint[][] = [[BigInt(1)]];
  for (const c of counts) prefix.push(convolve(prefix.at(-1)!, c.ways, left));
  const suffix: bigint[][] = Array(counts.length + 1);
  suffix[counts.length] = freeWays;
  for (let i = counts.length - 1; i >= 0; i--) {
    suffix[i] = convolve(counts[i].ways, suffix[i + 1], left);
  }
  const layouts = convolve(prefix[counts.length], freeWays, left)[left] ?? BigInt(0);
  if (!layouts) {
    return result(
      'conflict',
      '不存在同时满足数字线索和宝石总数的布局',
      constraints.flatMap((c) => c.sources),
    );
  }

  for (let i = 0; i < counts.length; i++) {
    const other = convolve(prefix[i], suffix[i + 1], left);
    for (const [v, hits] of counts[i].hits) {
      let numerator = BigInt(0);
      for (let k = 0; k < hits.length; k++) {
        numerator += hits[k] * (other[left - k] ?? BigInt(0));
      }
      probabilities[v] = ratio(numerator, layouts);
    }
  }
  if (outside.length) {
    let numerator = BigInt(0);
    for (let k = 0; k < prefix[counts.length].length; k++) {
      numerator +=
        prefix[counts.length][k] * choose(outside.length - 1, left - k - 1);
    }
    for (const v of outside) probabilities[v] = ratio(numerator, layouts);
  }

  const riskyFlags = findRiskyFlags(board, probabilities);
  return result(
    'exact',
    '已按全部合法布局精确计算',
    [],
    layouts.toString(),
    riskyFlags,
  );
}
