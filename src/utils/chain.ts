export function minimizeHash(
  hash: string,
  startLength = 4,
  endLength = 4
): string {
  if (hash.length <= startLength + endLength) return hash; // Se for muito curto, retorna o original
  return `${hash.slice(0, startLength)}...${hash.slice(-endLength)}`;
}