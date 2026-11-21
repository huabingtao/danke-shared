export interface QrCodeItem {
  url: string;
  description?: string;
}

export interface RankBatch {
  id: string;
  spaceId?: string;
  date: string;
  time: string;
  targetScore: number;
  maxCapacity?: number;
  currentCount?: number;
  avatarUrl: string;
  qrCodeUrl: string;
  qrCodes?: QrCodeItem[];
  notice: string;
  status: 'active' | 'invalid';
}

export interface RankSpaceSummary {
  id: string;
  name: string;
  note?: string;
  enabled: boolean;
  exists: boolean;
}

export type RankAdminRole = 'master' | 'sub_admin';

export interface RankSubAdmin {
  id: string;
  name: string;
  spaceId: string;
  token: string;
  note?: string;
  enabled: boolean;
  createdAt: string;
  batchCount?: number;
}
