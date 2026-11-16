export type QualityTokenKey =
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'q5'
  | 'q7'
  | 'q8'
  | 'q10'
  | 'q11'
  | 'q12'
  | 'q16';

export type AgentTierCode = 'COMMON' | 'S' | 'SP';

export const AGENT_CLASS_QUALITY_MAP = {
  COMMON: { quality: 'q3', badge: '普通', label: '普通特工' },
  S: { quality: 'q7', badge: 'S', label: 'S级特工' },
  SP: { quality: 'q11', badge: 'SP', label: 'SP特工' },
} as const satisfies Record<
  AgentTierCode,
  { quality: QualityTokenKey; badge: string; label: string }
>;

export const CATEGORY_STYLE_MAP = {
  AGENT: AGENT_CLASS_QUALITY_MAP,
  EQUIPMENT: {
    S: { quality: 'q10', badge: 'S', sMark: true },
    SS: { quality: 'q16', badge: 'SS', sMark: true },
  },
  COLLECTIBLE: {
    FINE: { quality: 'q2', badge: '精良' },
    BETTER: { quality: 'q3', badge: '优秀' },
    EXCELLENT: { quality: 'q4', badge: '杰出' },
    EPIC: { quality: 'q7', badge: '史诗' },
    LEGENDARY: { quality: 'q11', badge: '传奇' },
    SUPREME: { quality: 'q16', badge: '至宝' },
  },
  PET: {
    COMMON: { quality: 'q3', badge: '普通' },
    S: { quality: 'q16', badge: 'S级' },
    SKILL: { quality: 'q2', badge: '助战技能' },
  },
  TECH_PART: {
    NORMAL: { quality: 'q11', shape: 'hex', badge: '单配件' },
    SS: { quality: 'q16', shape: 'hex', badge: '双生谐振' },
  },
  MOUNT: {
    BETTER: { quality: 'q3', badge: '优秀' },
    EXCELLENT: { quality: 'q4', badge: '杰出' },
    EPIC: { quality: 'q7', badge: '史诗' },
    LEGENDARY: { quality: 'q11', badge: '传奇' },
  },
  MECHANIC: {
    BLUEPRINT: { quality: 'q1', badge: '图纸' },
    KEY: { quality: 'q3', badge: '钥匙' },
    MATERIAL: { quality: 'q4', badge: '材料' },
    SHARD: { quality: 'q7', badge: '碎片' },
    CORE: { quality: 'q10', badge: '核心' },
    CHEST: { quality: 'q16', badge: '宝箱' },
  },
  BUFF_AND_STAT: {
    POISON: { quality: 'q2', badge: '中毒' },
    CHILL: { quality: 'q3', badge: '冰缓' },
    WEAK: { quality: 'q4', badge: '衰弱' },
    VULN: { quality: 'q7', badge: '易伤' },
    FIRE: { quality: 'q10', badge: '神火' },
    LACER: { quality: 'q11', badge: '裂伤' },
    MULT: { quality: 'q16', badge: '乘区' },
  },
} as const;

export function getAgentClassQuality(
  agentClass: 'SP' | 'S' | '普通' | 'A' | 'COMMON',
): QualityTokenKey {
  if (agentClass === 'SP') return AGENT_CLASS_QUALITY_MAP.SP.quality;
  if (agentClass === 'S') return AGENT_CLASS_QUALITY_MAP.S.quality;
  return AGENT_CLASS_QUALITY_MAP.COMMON.quality;
}

export function hasQualityNotch(quality: QualityTokenKey): boolean {
  return quality === 'q5' || quality === 'q8' || quality === 'q12';
}

export interface CategoryQualityStyle {
  quality: QualityTokenKey;
  badge: string;
  sMark?: boolean;
}

export function getCollectibleStyle(rarityOrSubcategory?: string | null): CategoryQualityStyle {
  const key = (rarityOrSubcategory ?? '').trim().toUpperCase();
  if (key === 'SUPREME' || key.includes('至宝')) {
    return CATEGORY_STYLE_MAP.COLLECTIBLE.SUPREME;
  }
  if (key === 'LEGENDARY' || key.includes('传奇')) {
    return CATEGORY_STYLE_MAP.COLLECTIBLE.LEGENDARY;
  }
  if (key === 'EPIC' || key.includes('史诗')) {
    return CATEGORY_STYLE_MAP.COLLECTIBLE.EPIC;
  }
  if (key === 'EXCELLENT' || key.includes('杰出')) {
    return CATEGORY_STYLE_MAP.COLLECTIBLE.EXCELLENT;
  }
  if (key === 'BETTER' || key.includes('优秀')) {
    return CATEGORY_STYLE_MAP.COLLECTIBLE.BETTER;
  }
  if (key === 'FINE' || key.includes('精良')) {
    return CATEGORY_STYLE_MAP.COLLECTIBLE.FINE;
  }
  return { quality: 'q1', badge: '普通' };
}

export function getEquipmentStyle(rarityOrSubcategory?: string | null): CategoryQualityStyle {
  const key = (rarityOrSubcategory ?? '').trim().toUpperCase();
  if (key === 'SS' || key.includes('SS')) {
    return CATEGORY_STYLE_MAP.EQUIPMENT.SS;
  }
  return CATEGORY_STYLE_MAP.EQUIPMENT.S;
}

export function getPetStyle(
  rarityOrSubcategory?: string | null,
  subcategory?: string | null,
): CategoryQualityStyle {
  const combined = `${rarityOrSubcategory ?? ''} ${subcategory ?? ''}`.trim().toUpperCase();
  if (combined.includes('SKILL') || combined.includes('助战技能')) {
    return CATEGORY_STYLE_MAP.PET.SKILL;
  }
  if (
    combined === 'S' ||
    combined.includes('S级') ||
    combined.includes('SS') ||
    combined.includes('SP') ||
    combined.includes('LEGENDARY')
  ) {
    return CATEGORY_STYLE_MAP.PET.S;
  }
  return CATEGORY_STYLE_MAP.PET.COMMON;
}

export function getMountStyle(
  name?: string | null,
  rarity?: string | null,
): CategoryQualityStyle {
  const cleanName = (name ?? '').trim();
  if (
    cleanName.includes('末世战马') ||
    cleanName.includes('幽焰逐影') ||
    cleanName.includes('毁灭战甲')
  ) {
    return CATEGORY_STYLE_MAP.MOUNT.LEGENDARY;
  }
  if (cleanName.includes('科技滑板')) {
    return CATEGORY_STYLE_MAP.MOUNT.EXCELLENT;
  }
  if (cleanName.includes('电动平衡车')) {
    return CATEGORY_STYLE_MAP.MOUNT.BETTER;
  }

  const rar = (rarity ?? '').trim().toUpperCase();
  if (rar === 'LEGENDARY' || rar === 'SS' || rar === 'S' || rar === '11') {
    return CATEGORY_STYLE_MAP.MOUNT.LEGENDARY;
  }
  if (rar === 'EPIC' || rar === 'S_GOLD' || rar === '7') {
    return CATEGORY_STYLE_MAP.MOUNT.EPIC;
  }
  if (rar === 'EXCELLENT' || rar === '4') {
    return CATEGORY_STYLE_MAP.MOUNT.EXCELLENT;
  }
  if (rar === 'BETTER' || rar === '3') {
    return CATEGORY_STYLE_MAP.MOUNT.BETTER;
  }
  return CATEGORY_STYLE_MAP.MOUNT.LEGENDARY;
}

export function getMechanicQuality(
  subcategory?: string | null,
  rarity?: string | null,
  name?: string | null,
): QualityTokenKey {
  const cleanSub = (subcategory ?? '').trim();
  const cleanName = (name ?? '').trim();
  const rar = (rarity ?? '').trim().toUpperCase();

  if (cleanSub === '图纸' || cleanName.includes('图纸') || cleanName === '基础科技素材') {
    return 'q1';
  }
  if (cleanSub === '核心') {
    return rar === 'S' || cleanName.includes('载具核心') ? 'q7' : 'q10';
  }
  if (cleanName.includes('至宝') || rar === 'SS' || rar === 'SUPREME') {
    return 'q16';
  }
  if (rar === 'SP' || rar === 'LEGENDARY' || cleanName.includes('传奇')) {
    return 'q11';
  }
  if (cleanName.includes('杰出') && cleanName.includes('自选礼包')) {
    return 'q4';
  }
  if (rar === 'S' || cleanName.includes('史诗')) {
    return 'q7';
  }
  if (rar === 'EPIC' || cleanName.includes('杰出')) {
    return 'q4';
  }
  if (!rar && !cleanName) {
    if (cleanSub === '宝箱') return CATEGORY_STYLE_MAP.MECHANIC.CHEST.quality;
    if (cleanSub === '碎片') return CATEGORY_STYLE_MAP.MECHANIC.SHARD.quality;
    if (cleanSub === '材料') return CATEGORY_STYLE_MAP.MECHANIC.MATERIAL.quality;
    if (cleanSub === '钥匙') return CATEGORY_STYLE_MAP.MECHANIC.KEY.quality;
  }
  return 'q3';
}

export function getMechanicStyle(
  subcategory?: string | null,
  rarity?: string | null,
  name?: string | null,
): CategoryQualityStyle {
  const cleanSub = (subcategory ?? '').trim();
  return {
    quality: getMechanicQuality(cleanSub, rarity, name),
    badge: cleanSub || '消耗品',
  };
}

