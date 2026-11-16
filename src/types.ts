export type ThemeMode = 'light' | 'dark';

export type ToolTier = 'core' | 'seasonal' | 'wip';

export interface CatalogEntry {
  name: string;
  icon: string;
  preview?: string;
}

export interface ClassificationItem {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sortOrder?: number;
  count?: number;
}

export interface ResourceViewEntry {
  id: string;
  label: string;
  icon?: string;
  categories?: string[];
}

export interface WebItemRecord {
  id: string;
  name: string;
  icon?: string | null;
  category?: string;
  classification?: string;
  rarity?: string | number;
  description?: string;
}

export interface StrategySummary {
  id?: string;
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  categoryLabel?: string;
  badge?: string;
  cover?: string;
  updatedAt?: string;
  readTime?: string;
}

export interface HomeToolEntry {
  id: string;
  title: string;
  summary: string;
  href: string;
  external?: boolean;
  tier: ToolTier;
  activeWeek?: boolean;
  statusLabel?: string;
}

