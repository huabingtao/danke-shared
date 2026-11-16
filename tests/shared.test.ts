import { describe, expect, it } from 'vitest';
import {
  parseDomainOriginMap,
  resolveAssetsBase,
  resolveCoreApiBase,
} from '../src/config';
import {
  CANONICAL_ITEM_CATEGORY_ICON_PATHS,
  WIKI_CATEGORY_ICON_PATHS,
  resolveItemCategoryDisplayIcon,
  resolveItemIconUrl,
} from '../src/assets';

describe('@danke/shared config resolution', () => {
  it('resolves browser origin using domainMap when provided without hardcoding', () => {
    const mapJson = JSON.stringify({
      'example.top': 'https://api.example.top',
      'hub.example.cn': 'https://core.hub.example.cn',
    });
    expect(
      resolveCoreApiBase({
        isServer: false,
        hostname: 'www.example.top',
        protocol: 'https:',
        env: { NODE_ENV: 'production', NEXT_PUBLIC_CORE_ORIGIN_MAP: mapJson },
      }),
    ).toBe('https://api.example.top');

    expect(
      resolveCoreApiBase({
        isServer: false,
        hostname: 'hub.example.cn',
        protocol: 'https:',
        env: { NODE_ENV: 'production', NEXT_PUBLIC_CORE_ORIGIN_MAP: mapJson },
      }),
    ).toBe('https://core.hub.example.cn');
  });

  it('prefers CORE_API_INTERNAL_URL on server and fails in production when unconfigured', () => {
    expect(
      resolveCoreApiBase({
        isServer: true,
        env: {
          NODE_ENV: 'production',
          CORE_API_INTERNAL_URL: 'http://internal-core:6101/',
          NEXT_PUBLIC_CORE_API_URL: 'https://public.example.test',
        },
      }),
    ).toBe('http://internal-core:6101');

    expect(() =>
      resolveCoreApiBase({
        isServer: true,
        env: { NODE_ENV: 'production' },
      }),
    ).toThrow(/NEXT_PUBLIC_CORE_API_URL/);
  });

  it('uses configured port in local development without throwing', () => {
    expect(
      resolveCoreApiBase({
        isServer: false,
        hostname: '192.168.1.5',
        protocol: 'http:',
        env: { NODE_ENV: 'development', NEXT_PUBLIC_CORE_PORT: '7001' },
      }),
    ).toBe('http://192.168.1.5:7001');
  });

  it('parses invalid domain maps safely to empty object', () => {
    expect(parseDomainOriginMap('{broken-json')).toEqual({});
  });
});

describe('@danke/shared asset icon resolution', () => {
  it('resolves relative upload paths via assetsBase before coreBase', () => {
    expect(
      resolveAssetsBase({ env: { NEXT_PUBLIC_ASSETS_BASE_URL: 'https://cdn.example.test/' } }),
    ).toBe('https://cdn.example.test');

    expect(
      resolveItemIconUrl('科萌', '/uploads/item-icons/test.png', {
        assetsBase: 'https://cdn.example.test',
        coreBase: 'https://api.example.test',
      }),
    ).toBe('https://cdn.example.test/uploads/item-icons/test.png');

    expect(
      resolveItemIconUrl('科萌', '/uploads/item-icons/test.png', {
        assetsBase: '',
        coreBase: 'https://api.example.test',
      }),
    ).toBe('https://api.example.test/uploads/item-icons/test.png');
  });

  it('falls back to catalog entry then default item icon path when explicit icon is missing', () => {
    expect(
      resolveItemIconUrl('记忆编辑器', null, {
        catalog: [{ name: '记忆编辑器', icon: '/uploads/item-icons/editor.png' }],
        assetsBase: 'https://cdn.example.test',
      }),
    ).toBe('https://cdn.example.test/uploads/item-icons/editor.png');

    expect(resolveItemIconUrl('未知道具', null)).toBe(
      `/icons/items/${encodeURIComponent('未知道具')}.png`,
    );
  });

  it('keeps canonical category icons unified between wiki categories and resource filters', () => {
    expect(WIKI_CATEGORY_ICON_PATHS.AGENT).toBe(CANONICAL_ITEM_CATEGORY_ICON_PATHS.agent);
    expect(WIKI_CATEGORY_ICON_PATHS.TECH_PART).toBe(CANONICAL_ITEM_CATEGORY_ICON_PATHS.tech);
    expect(WIKI_CATEGORY_ICON_PATHS.COLLECTIBLE).toBe(CANONICAL_ITEM_CATEGORY_ICON_PATHS.collection);

    expect(resolveItemCategoryDisplayIcon('agent', '/uploads/item-icons/categories/agent.png')).toBe(
      '/wiki-assets/特工/科萌.png',
    );
    expect(resolveItemCategoryDisplayIcon('tech', '/uploads/item-icons/categories/tech.png')).toBe(
      '/wiki-assets/配件/双生无人机.png',
    );
    expect(
      resolveItemCategoryDisplayIcon('collection', '/uploads/item-icons/categories/legendary.png'),
    ).toBe('/wiki-assets/宝箱/至宝收藏品自选宝箱.png');
    expect(resolveItemCategoryDisplayIcon('core', '/uploads/item-icons/categories/core.png')).toBe(
      '/uploads/item-icons/categories/core.png',
    );
    expect(resolveItemCategoryDisplayIcon('constructor', '/fallback.png')).toBe('/fallback.png');
  });

  it('maps agent tiers and category quality tokens consistently', async () => {
    const {
      AGENT_CLASS_QUALITY_MAP,
      CATEGORY_STYLE_MAP,
      getAgentClassQuality,
      hasQualityNotch,
    } = await import('../src/index');

    expect(AGENT_CLASS_QUALITY_MAP.SP.quality).toBe('q11');
    expect(AGENT_CLASS_QUALITY_MAP.S.quality).toBe('q7');
    expect(AGENT_CLASS_QUALITY_MAP.COMMON.quality).toBe('q3');
    expect(CATEGORY_STYLE_MAP.AGENT).toBe(AGENT_CLASS_QUALITY_MAP);

    expect(getAgentClassQuality('SP')).toBe('q11');
    expect(getAgentClassQuality('S')).toBe('q7');
    expect(getAgentClassQuality('普通')).toBe('q3');
    expect(getAgentClassQuality('A')).toBe('q3');
    expect(getAgentClassQuality('COMMON')).toBe('q3');

    expect(hasQualityNotch('q11')).toBe(false);
    expect(hasQualityNotch('q12')).toBe(true);
    expect(hasQualityNotch('q16')).toBe(false);
  });

  it('resolves category quality tokens and badges for collectibles, equipment, pets, mounts, and mechanics', async () => {
    const {
      getCollectibleStyle,
      getEquipmentStyle,
      getMechanicQuality,
      getMechanicStyle,
      getMountStyle,
      getPetStyle,
    } = await import('../src/index');

    expect(getCollectibleStyle('SUPREME')).toEqual({ quality: 'q16', badge: '至宝' });
    expect(getCollectibleStyle('LEGENDARY')).toEqual({ quality: 'q11', badge: '传奇' });
    expect(getCollectibleStyle('EPIC')).toEqual({ quality: 'q7', badge: '史诗' });
    expect(getCollectibleStyle('EXCELLENT')).toEqual({ quality: 'q4', badge: '杰出' });
    expect(getCollectibleStyle('BETTER')).toEqual({ quality: 'q3', badge: '优秀' });
    expect(getCollectibleStyle('FINE')).toEqual({ quality: 'q2', badge: '精良' });
    expect(getCollectibleStyle('COMMON')).toEqual({ quality: 'q1', badge: '普通' });

    expect(getEquipmentStyle('SS')).toEqual({ quality: 'q16', badge: 'SS', sMark: true });
    expect(getEquipmentStyle('S')).toEqual({ quality: 'q10', badge: 'S', sMark: true });

    expect(getPetStyle('S', 'S级')).toEqual({ quality: 'q16', badge: 'S级' });
    expect(getPetStyle('COMMON', '普通')).toEqual({ quality: 'q3', badge: '普通' });
    expect(getPetStyle('COMMON', '助战技能')).toEqual({ quality: 'q2', badge: '助战技能' });

    expect(getMountStyle('末世战马', 'LEGENDARY')).toEqual({ quality: 'q11', badge: '传奇' });
    expect(getMountStyle('幽焰逐影', 'LEGENDARY')).toEqual({ quality: 'q11', badge: '传奇' });
    expect(getMountStyle('毁灭战甲', 'LEGENDARY')).toEqual({ quality: 'q11', badge: '传奇' });
    expect(getMountStyle('科技滑板', 'EXCELLENT')).toEqual({ quality: 'q4', badge: '杰出' });
    expect(getMountStyle('电动平衡车', 'BETTER')).toEqual({ quality: 'q3', badge: '优秀' });
    // Legacy/stale rarity strings still resolve by canonical mount name
    expect(getMountStyle('末世战马', 'SS')).toEqual({ quality: 'q11', badge: '传奇' });
    expect(getMountStyle('科技滑板', 'S')).toEqual({ quality: 'q4', badge: '杰出' });
    expect(getMountStyle('电动平衡车', 'EPIC')).toEqual({ quality: 'q3', badge: '优秀' });

    expect(getMechanicQuality('图纸', 'COMMON', '武器图纸')).toBe('q1');
    expect(getMechanicQuality('材料', 'COMMON', '基础科技素材')).toBe('q1');
    expect(getMechanicQuality('钥匙', 'COMMON', '普通钥匙')).toBe('q3');
    expect(getMechanicQuality('钥匙', 'EPIC', '高级钥匙')).toBe('q4');
    expect(getMechanicQuality('钥匙', 'S', 'S级军备钥匙')).toBe('q7');
    expect(getMechanicQuality('宝箱', 'S', 'S级杰出装备自选礼包')).toBe('q4');
    expect(getMechanicQuality('宝箱', 'EPIC', '史诗收藏品自选礼包')).toBe('q7');
    expect(getMechanicQuality('核心', 'SS', '神器核心')).toBe('q10');
    expect(getMechanicQuality('核心', 'S', '载具核心')).toBe('q7');
    expect(getMechanicQuality('碎片', 'SP', '末世战马碎片')).toBe('q11');
    expect(getMechanicQuality('宝箱', 'SS', '至宝收藏品自选宝箱')).toBe('q16');
    expect(getMechanicStyle('核心', 'SS', '神器核心')).toEqual({ quality: 'q10', badge: '核心' });
  });
});

