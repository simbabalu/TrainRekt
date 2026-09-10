export function abbreviateWalletAddress(address: string): string {
  const normalized = address.trim();
  if (normalized.length <= 10) return normalized;
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}
