export type RanchCropKey =
  | 'egg'
  | 'milk'
  | 'goose'
  | 'honey'
  | 'wool'
  | 'feather';

export interface RanchCropConfig {
  key: RanchCropKey;
  emoji: string;
  name: string;
  min: number;
  max: number;
  range: string;
}

export interface RanchEntry {
  itemId: string;
  id: string;
  price: number;
  online: boolean;
  ownerId: string;
  likes: number;
  updatedAt?: number;
}

export type RanchBoardData = Record<RanchCropKey, RanchEntry[]>;

export interface RanchRuntimeConfig {
  timezone: string;
  eventResetUntil: string | null;
  contactWechat: string;
}
