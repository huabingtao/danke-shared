import type { RanchBoardData, RanchCropConfig, RanchCropKey, RanchEntry } from './types';

export const RANCH_CROP_CONFIGS: Record<RanchCropKey, RanchCropConfig> = {
  egg: { key: 'egg', emoji: '🥚', name: '鸡蛋', min: 225, max: 250, range: '225 - 250' },
  milk: { key: 'milk', emoji: '🥛', name: '牛奶', min: 225, max: 250, range: '225 - 250' },
  goose: { key: 'goose', emoji: '🪶', name: '鹅绒', min: 675, max: 750, range: '675 - 750' },
  honey: { key: 'honey', emoji: '🍯', name: '蜂蜜', min: 675, max: 750, range: '675 - 750' },
  wool: { key: 'wool', emoji: '🐑', name: '羊毛', min: 2250, max: 2500, range: '2250 - 2500' },
  feather: { key: 'feather', emoji: '🦚', name: '翎羽', min: 6750, max: 7500, range: '6750 - 7500' },
};

export const RANCH_CROP_ORDER: RanchCropKey[] = [
  'egg',
  'milk',
  'goose',
  'honey',
  'wool',
  'feather',
];

export function createEmptyRanchBoard(): RanchBoardData {
  return {
    egg: [],
    milk: [],
    goose: [],
    honey: [],
    wool: [],
    feather: [],
  };
}

export function sortCropItems(items: RanchEntry[]): RanchEntry[] {
  return [...items].sort((a, b) => {
    const aOnline = typeof a.online === 'boolean' ? a.online : true;
    const bOnline = typeof b.online === 'boolean' ? b.online : true;
    if (aOnline !== bOnline) {
      return aOnline ? -1 : 1;
    }
    return b.price - a.price;
  });
}

export function cleanNumericInput(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export interface RanchInputValidation {
  ok: boolean;
  cleanId: string;
  cleanPrice: number;
  error?: string;
}

export function validateRanchEntryInput(
  cropKey: RanchCropKey,
  rawId: string,
  rawPrice: string,
): RanchInputValidation {
  const crop = RANCH_CROP_CONFIGS[cropKey];
  const cleanId = cleanNumericInput(rawId);
  if (cleanId.length < 5 || cleanId.length > 15) {
    return {
      ok: false,
      cleanId,
      cleanPrice: 0,
      error: '请输入 5 ~ 15 位纯数字游戏 ID',
    };
  }
  const cleanPrice = Number.parseInt(cleanNumericInput(rawPrice), 10);
  if (!Number.isFinite(cleanPrice) || cleanPrice < 1 || cleanPrice > crop.max) {
    return {
      ok: false,
      cleanId,
      cleanPrice: 0,
      error: `${crop.name}最高参考价为 ${crop.max}，请输入 1 ~ ${crop.max} 的整数`,
    };
  }
  return { ok: true, cleanId, cleanPrice };
}

export function filterCropItems(
  items: RanchEntry[],
  options: { onlyOnline: boolean; searchQuery: string },
): RanchEntry[] {
  const query = options.searchQuery.trim();
  return sortCropItems(items).filter((item) => {
    if (options.onlyOnline && !item.online) return false;
    if (query && !item.id.includes(query)) return false;
    return true;
  });
}

export function buildSummaryCopyText(
  board: RanchBoardData,
  options: { onlyOnline?: boolean } = {},
): string {
  const onlyOnline = options.onlyOnline ?? true;
  const sections: string[] = [];

  for (const key of RANCH_CROP_ORDER) {
    const crop = RANCH_CROP_CONFIGS[key];
    const items = sortCropItems(board[key] || []).filter((item) =>
      onlyOnline ? item.online : true,
    );
    if (items.length === 0) continue;
    const lines = items.slice(0, 3).map((item, idx) => {
      const medal = idx === 0 ? '👑' : `#${idx + 1}`;
      const stateTag = item.online ? '' : '（已下线）';
      const likesTag = item.likes > 0 ? ` · 👍${item.likes}` : '';
      return `  ${medal} ID: ${item.id} ｜ 单价 ${item.price}${stateTag}${likesTag}`;
    });
    sections.push(`${crop.emoji} ${crop.name}（高价参考 ${crop.range}）\n${lines.join('\n')}`);
  }

  if (sections.length === 0) {
    return '【弹壳特攻队 · 欢乐牧场高价榜】当前暂无在线报价，欢迎上传你的高价作物 ID 互助卖菜！';
  }
  return `【弹壳特攻队 · 欢乐牧场高价菜播报】\n${sections.join('\n\n')}`;
}

export function getNextResetDescription(
  eventResetUntil: string | null,
): string {
  if (eventResetUntil) {
    return `活动期间每 2 小时整点自动清空重置（截止 ${eventResetUntil} · 东八区）`;
  }
  return '每日 18:00（东八区）自动清空过期报价';
}
