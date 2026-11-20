import type { Node } from './store';
import type { SemanticPairScore } from '@/core/semantic/semanticClient';

export function semanticContentKey(nodes: readonly Node[]): string {
  return nodes
    .map(node => `${node.id}\u001f${node.title}\u001f${node.body}\u001f${(node.bullets ?? []).join('\u001e')}`)
    .sort()
    .join('\u001d');
}

/** Gently attracts semantically close nodes while preserving the existing 3D layout. */
export function clusterSimilarNodes(
  nodes: readonly Node[],
  similarities: readonly SemanticPairScore[],
): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>(
    nodes.map(node => [node.id, [...node.position] as [number, number, number]]),
  );
  const pairs = similarities
    .filter(pair => pair.similarity > 0.28 && positions.has(pair.leftId) && positions.has(pair.rightId))
    .map(pair => ({
      leftId: pair.leftId,
      rightId: pair.rightId,
      strength: Math.min(0.95, Math.max(0, pair.similarity)),
      target: 1.8 + (1 - Math.min(1, Math.max(0, pair.similarity))) * 4.5,
    }));

  for (let iteration = 0; iteration < 72; iteration += 1) {
    for (const pair of pairs) {
      const left = positions.get(pair.leftId)!;
      const right = positions.get(pair.rightId)!;
      const delta: [number, number, number] = [right[0] - left[0], right[1] - left[1], right[2] - left[2]];
      const distance = Math.hypot(...delta);
      if (distance < 0.001) continue;
      const movement = Math.max(-0.18, Math.min(0.18, (distance - pair.target) * pair.strength * 0.035));
      for (let axis = 0; axis < 3; axis += 1) {
        const shift = (delta[axis] / distance) * movement;
        left[axis] += shift;
        right[axis] -= shift;
      }
    }
    for (const position of positions.values()) {
      const radius = Math.hypot(...position);
      if (radius > 10) {
        const scale = 10 / radius;
        position[0] *= scale;
        position[1] *= scale;
        position[2] *= scale;
      }
    }
  }

  for (const position of positions.values()) {
    position[0] = Number(position[0].toFixed(2));
    position[1] = Number(position[1].toFixed(2));
    position[2] = Number(position[2].toFixed(2));
  }
  return positions;
}
