export type LastDayMode = 'NONE' | 'REDEEM_ONLY' | 'VIEW_ONLY';

export interface CycleRuleInput {
  id?: string;
  name?: string;
  ruleType?: string;
  routineType?: string | null;
  weeklyDay?: number | null;
  startDate?: Date | string | null;
  durationDays?: number | null;
  cycleDays?: number | null;
  hasRedeemDay?: boolean | null;
  lastDayMode?: string | null;
  digestTemplate?: string | null;
  redeemTemplate?: string | null;
  routineTemplate?: string | null;
}

export function resolveEffectiveLastDayMode(rule: {
  lastDayMode?: string | null;
  hasRedeemDay?: boolean | null;
}): LastDayMode {
  if (rule.lastDayMode === 'REDEEM_ONLY' || rule.lastDayMode === 'VIEW_ONLY') {
    return rule.lastDayMode;
  }
  if (rule.lastDayMode === 'NONE' && rule.hasRedeemDay === undefined) {
    return 'NONE';
  }
  return rule.hasRedeemDay ? 'REDEEM_ONLY' : 'NONE';
}

export function hasSpecialLastDay(rule: {
  hasRedeemDay?: boolean | null;
  lastDayMode?: string | null;
}): boolean {
  return resolveEffectiveLastDayMode(rule) !== 'NONE';
}

const MS_PER_DAY = 86_400_000;
const BEIJING_OFFSET_MS = 8 * 3600_000;

/** Returns a Date shifted so its UTC fields represent Beijing time (UTC+8). */
export function getBeijingNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + BEIJING_OFFSET_MS);
}

export function getBeijingDateStr(now: Date = new Date()): string {
  const bj = getBeijingNow(now);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toCalendarDay(input: Date | string): number {
  if (typeof input === 'string') {
    const parts = input.substring(0, 10).split('-');
    if (parts.length === 3) {
      return (
        Date.UTC(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10),
        ) / MS_PER_DAY
      );
    }
  }
  const d = new Date(input);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_PER_DAY;
}

export function computeCycleState(
  rule: {
    startDate: Date | string;
    durationDays?: number | null;
    cycleDays?: number | null;
    hasRedeemDay?: boolean | null;
    lastDayMode?: string | null;
  },
  target: Date = new Date(),
) {
  const targetDay =
    Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) / MS_PER_DAY;
  const startDay = toCalendarDay(rule.startDate);
  const diffDays = targetDay - startDay;
  const durationDays = rule.durationDays || 7;
  const effectiveLastDayMode = resolveEffectiveLastDayMode(rule);
  const specialLastDay = effectiveLastDayMode !== 'NONE';
  const eventDays = durationDays + (specialLastDay ? 1 : 0);
  const cycleDays = Math.max(rule.cycleDays || eventDays, eventDays);
  const base = { durationDays, cycleDays, lastDayMode: effectiveLastDayMode };

  if (diffDays < 0) {
    return {
      ...base,
      computedStatus: 'UPCOMING' as const,
      daysRemaining: -diffDays,
      playableDaysRemaining: 0,
      dayInCycle: -1,
      isFirstDay: false,
      cycleIndex: -1,
    };
  }

  const cycleIndex = Math.floor(diffDays / cycleDays);
  const dayInCycle = diffDays % cycleDays;
  if (dayInCycle < durationDays) {
    return {
      ...base,
      computedStatus: 'ACTIVE' as const,
      daysRemaining: eventDays - dayInCycle,
      playableDaysRemaining: durationDays - dayInCycle,
      dayInCycle,
      isFirstDay: dayInCycle === 0,
      cycleIndex,
    };
  }
  if (specialLastDay && dayInCycle === durationDays) {
    return {
      ...base,
      computedStatus: 'REDEEM' as const,
      daysRemaining: 1,
      playableDaysRemaining: 0,
      dayInCycle,
      isFirstDay: false,
      cycleIndex,
    };
  }
  return {
    ...base,
    computedStatus: 'COOLDOWN' as const,
    daysRemaining: cycleDays - dayInCycle,
    playableDaysRemaining: 0,
    dayInCycle,
    isFirstDay: false,
    cycleIndex,
  };
}

/**
 * Generates a stable cycle key for local check-in persistence.
 * When a new cycle begins, the key changes automatically so completed state resets.
 */
export function getReminderCycleKey(rule: CycleRuleInput, now: Date = new Date()): string {
  const bj = getBeijingNow(now);
  const y = bj.getUTCFullYear();
  const m = bj.getUTCMonth();
  const d = bj.getUTCDate();

  if (rule.ruleType === 'CYCLE' && rule.startDate) {
    const bjLocal = new Date(y, m, d, 0, 0, 0, 0);
    const state = computeCycleState(
      {
        startDate: rule.startDate,
        durationDays: rule.durationDays,
        cycleDays: rule.cycleDays,
        hasRedeemDay: rule.hasRedeemDay,
        lastDayMode: rule.lastDayMode,
      },
      bjLocal,
    );
    return `cycle:${state.cycleIndex}`;
  }

  if (rule.routineType === 'WEEKLY') {
    const weekday = bj.getUTCDay();
    const diffToMonday = (weekday + 6) % 7;
    const monday = new Date(Date.UTC(y, m, d - diffToMonday));
    const my = monday.getUTCFullYear();
    const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
    const md = String(monday.getUTCDate()).padStart(2, '0');
    return `weekly:${my}-${mm}-${md}`;
  }

  return `daily:${getBeijingDateStr(now)}`;
}
