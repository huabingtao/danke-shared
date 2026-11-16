import { resolveAssetsBase, resolveCoreApiBase, type EnvMap } from './config';
import type { CatalogEntry } from './types';

export interface ResolveItemIconOptions {
  catalog?: readonly CatalogEntry[];
  assetsBase?: string;
  coreBase?: string;
  env?: EnvMap;
}

export function normalizeAssetPath(iconPath: string): string {
  return (iconPath || '').trim();
}

export function resolveItemIconPath(
  iconUrl: string,
  options: ResolveItemIconOptions = {},
): string {
  const cleaned = normalizeAssetPath(iconUrl);
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('data:')) {
    return cleaned;
  }
  if (cleaned.startsWith('/uploads/') || cleaned.startsWith('/game-assets/')) {
    const assetsBase =
      options.assetsBase !== undefined
        ? options.assetsBase.trim().replace(/\/+$/, '')
        : resolveAssetsBase({ env: options.env });
    if (assetsBase) {
      return `${assetsBase}${cleaned}`;
    }
    const coreBase =
      options.coreBase !== undefined
        ? options.coreBase.trim().replace(/\/+$/, '')
        : resolveCoreApiBase({ env: options.env });
    return coreBase ? `${coreBase}${cleaned}` : cleaned;
  }
  return cleaned;
}

export function resolveItemIconUrl(
  itemName: string,
  iconUrl?: string | null,
  options: ResolveItemIconOptions = {},
): string {
  const direct = normalizeAssetPath(iconUrl || '');
  if (direct) {
    return resolveItemIconPath(direct, options);
  }

  const normalizedName = (itemName || '').trim();
  if (normalizedName && options.catalog && options.catalog.length > 0) {
    const matched = options.catalog.find((entry) => entry.name === normalizedName);
    if (matched?.icon) {
      return resolveItemIconPath(matched.icon, options);
    }
  }

  return `/icons/items/${encodeURIComponent(normalizedName)}.png`;
}

export function resolveCategoryIconUrl(
  categorySlug: string,
  explicitIcon?: string | null,
  options: ResolveItemIconOptions = {},
): string {
  if (explicitIcon && explicitIcon.trim()) {
    return resolveItemIconPath(explicitIcon.trim(), options);
  }
  const slug = encodeURIComponent((categorySlug || 'general').trim());
  return resolveItemIconPath(`/uploads/item-icons/categories/${slug}.png`, options);
}

/**
 * Single source of truth for item-classification & wiki category icon paths shared across apps.
 */
export const CANONICAL_ITEM_CATEGORY_ICON_PATHS = {
  agent: '/wiki-assets/特工/科萌.png',
  tech: '/wiki-assets/配件/双生无人机.png',
  collection: '/wiki-assets/宝箱/至宝收藏品自选宝箱.png',
} as const satisfies Record<string, string>;

export const WIKI_CATEGORY_ICON_PATHS = {
  AGENT: CANONICAL_ITEM_CATEGORY_ICON_PATHS.agent,
  COLLECTIBLE: CANONICAL_ITEM_CATEGORY_ICON_PATHS.collection,
  EQUIPMENT: '/sio-icons/items/twin_lance_ss5.webp',
  PET: '/wiki-assets/宠物/幽暗之灵.png',
  TECH_PART: CANONICAL_ITEM_CATEGORY_ICON_PATHS.tech,
  MOUNT: '/wiki-assets/载具/幽焰逐影.png',
  MECHANIC: '/wiki-assets/道具/神器核心.png',
  BUFF: '/sio-icons/pets/skills/encouragement.webp',
  DAMAGE_STAT: '/sio-icons/damage_dealt.webp',
} as const satisfies Record<string, string>;

/**
 * Resolves the canonical display icon for an item category ID, overriding stale backend fallbacks
 * while preserving the backend-supplied icon path for categories without an explicit override.
 */
export function resolveItemCategoryDisplayIcon(
  categoryId: string,
  serverIcon?: string | null,
): string | null {
  const key = categoryId.trim();
  if (Object.prototype.hasOwnProperty.call(CANONICAL_ITEM_CATEGORY_ICON_PATHS, key)) {
    return CANONICAL_ITEM_CATEGORY_ICON_PATHS[
      key as keyof typeof CANONICAL_ITEM_CATEGORY_ICON_PATHS
    ];
  }
  const trimmed = serverIcon?.trim();
  return trimmed || null;
}

