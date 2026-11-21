export interface UpgradeStage { id: number; threshold: number; costs: Record<string, number | null>; effect: string; sourceId: string }
export interface MatrixStage extends UpgradeStage {
  descriptionId: string;
  effectSections: { scope: string; text: string }[];
  appearance: 'unlocked' | 'all' | null;
}
export const materials = [
  { id: '11000', name: '矩阵能量', description: '用于激活解锁的矩阵小队条目。', icon: '/wiki-assets/道具/矩阵能量.png' },
  { id: '6202', name: '特工觉醒核心', description: '可用于特工觉醒的神秘核心，也是矩阵小队条目的激活材料。', icon: '/wiki-assets/道具/特工觉醒核心.png' },
];
export function intervalCosts(stages: UpgradeStage[], current: number, target: number) {
  if (!Number.isInteger(current) || !Number.isInteger(target) || current < 0 || target < current || target > stages.length) return null;
  const totals: Record<string, number | null> = {};
  for (const stage of stages.slice(current, target)) {
    for (const [id, quantity] of Object.entries(stage.costs)) {
      totals[id] = totals[id] === null || quantity === null ? null : (totals[id] ?? 0) + quantity;
    }
  }
  return totals;
}
