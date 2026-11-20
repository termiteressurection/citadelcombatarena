
export function getNumericId(nodeId: string): number {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash = (hash << 5) - hash + nodeId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 1000000 + 20000;
}
