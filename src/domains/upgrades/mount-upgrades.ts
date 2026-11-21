export interface MountStage { star: number; costs: Record<string, number>; sourceId: string }
export interface MountProgression {
  id: string; name: string; quality: string; icon: string;
  materials: { id: string; name: string; icon: string }[];
  stages: MountStage[];
}
export function cumulativeMountCosts(stages: MountStage[], targetStar: number): Record<string, number> | null {
  if (!Number.isInteger(targetStar) || targetStar < 0 || !stages.some(stage => stage.star === targetStar)) return null;
  const costs: Record<string, number> = {};
  for (const stage of stages.filter(stage => stage.star <= targetStar)) {
    for (const [id, quantity] of Object.entries(stage.costs)) costs[id] = (costs[id] ?? 0) + quantity;
  }
  return costs;
}

export function groupMountProgressions(vehicles: MountProgression[]) {
  const groups = new Map<string, { quality: string; vehicles: MountProgression[] }>();
  for (const vehicle of vehicles) {
    // Fragment IDs differ per vehicle; other material IDs must still match.
    const fragmentId = vehicle.materials[0]?.id;
    const signature = JSON.stringify(
      [...vehicle.stages]
        .sort((a, b) => a.star - b.star)
        .map(stage => ({
          star: stage.star,
          costs: Object.entries(stage.costs)
            .map(([id, count]) => [id === fragmentId ? 'fragment' : id, count] as const)
            .sort(([a], [b]) => a.localeCompare(b)),
        })),
    );
    const key = JSON.stringify([vehicle.quality, signature]);
    const group = groups.get(key) ?? { quality: vehicle.quality, vehicles: [] };
    group.vehicles.push(vehicle);
    groups.set(key, group);
  }
  const order = ['优秀', '杰出', '传奇'];
  const rank = (quality: string) => {
    const idx = order.indexOf(quality);
    return idx === -1 ? order.length : idx;
  };
  return [...groups.values()].sort((a, b) => rank(a.quality) - rank(b.quality));
}
