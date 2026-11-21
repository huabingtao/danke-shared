const ORANGE_TARGET_SCORES = new Set([67, 107]);

export function isOrangeBatchScore(targetScore: number): boolean {
  return ORANGE_TARGET_SCORES.has(Number(targetScore));
}

export function getShanghaiDateStr(nowMs = Date.now()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(nowMs));
}

export function getShanghaiTimeStr(nowMs = Date.now()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return formatter.format(new Date(nowMs));
}

export function normalizeTimeWithSeconds(timeStr: string): string {
  const clean = (timeStr || '').trim();
  if (!clean) return '00:00:00';
  return clean.split(':').length === 2 ? `${clean}:00` : clean;
}

export function getBatchUnlockTimestamp(dateStr: string): number {
  if (!dateStr || typeof dateStr !== 'string') return Number.NaN;
  const cleanDate = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return Number.NaN;
  return new Date(`${cleanDate}T00:10:00+08:00`).getTime();
}

export function getBatchTargetTimestamp(dateStr: string, timeStr: string): number {
  const cleanDate = (dateStr || '').trim();
  const normalizedTime = normalizeTimeWithSeconds(timeStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return Number.NaN;
  return new Date(`${cleanDate}T${normalizedTime}+08:00`).getTime();
}

export function isBatchUnlocked(
  dateStr: string,
  targetScore: number,
  nowMs = Date.now(),
): boolean {
  if (isOrangeBatchScore(targetScore)) return true;
  const unlockTime = getBatchUnlockTimestamp(dateStr);
  return Number.isNaN(unlockTime) || nowMs >= unlockTime;
}

export function formatDurationParts(diffMs: number): string {
  const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return days > 0 ? `${days}天 ${hms}` : hms;
}

export interface BatchCountdownState {
  isExpired: boolean;
  isUnlocked: boolean;
  text: string;
  label: string;
}

export function getBatchCountdownState(
  dateStr: string,
  timeStr: string,
  targetScore: number,
  nowMs = Date.now(),
): BatchCountdownState {
  try {
    const targetTime = getBatchTargetTimestamp(dateStr, timeStr);
    if (Number.isNaN(targetTime)) {
      return {
        isExpired: false,
        isUnlocked: true,
        text: '时间待定',
        label: '实时发车倒计时',
      };
    }

    const unlocked = isBatchUnlocked(dateStr, targetScore, nowMs);
    if (!unlocked) {
      const unlockTime = getBatchUnlockTimestamp(dateStr);
      return {
        isExpired: false,
        isUnlocked: false,
        text: formatDurationParts(unlockTime - nowMs),
        label: '距离 00:10 解密',
      };
    }

    const diffMs = targetTime - nowMs;
    if (diffMs <= 0) {
      return {
        isExpired: true,
        isUnlocked: true,
        text: '已到发车时间',
        label: '实时发车倒计时',
      };
    }

    return {
      isExpired: false,
      isUnlocked: true,
      text: formatDurationParts(diffMs),
      label: '实时发车倒计时',
    };
  } catch {
    return {
      isExpired: false,
      isUnlocked: true,
      text: '计算中...',
      label: '实时发车倒计时',
    };
  }
}

export interface PrecisionClockParts {
  hours: string;
  mins: string;
  secs: string;
  ms: string;
  expired: boolean;
}

export function computePrecisionClockParts(
  dateStr: string,
  timeStr: string,
  isUnlocked: boolean,
  nowMs = Date.now(),
): PrecisionClockParts {
  const targetMs = isUnlocked
    ? getBatchTargetTimestamp(dateStr, timeStr)
    : getBatchUnlockTimestamp(dateStr);

  if (Number.isNaN(targetMs)) {
    return { hours: '00', mins: '00', secs: '00', ms: '00', expired: false };
  }

  const rawDiff = targetMs - nowMs;
  const expired = rawDiff <= 0;
  const diff = Math.max(0, rawDiff);

  const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  const ms = String(Math.floor(((diff % 1000) / 1000) * 60)).padStart(2, '0');

  return { hours, mins, secs, ms, expired };
}

export function getNoticeDefault(score: number): string {
  const target = score || 66;
  return `本群为${target}精准并列群，非${target}的朋友请自觉退群。\n📢 活动并列第一怎么玩？\n• 第一天：进度${target}，0点前下线。\n• 第二天：看群通知，几百人秒级同步上线。\n• 分到一组的人：5人建群，商量好不要动进度。\n• 后面几天：继续保持同分，一起拿第一。`;
}
