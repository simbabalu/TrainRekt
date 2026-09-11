export function formatWalletSnapshotTime(isoTimestamp: string, now = new Date()): string {
  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return 'Unavailable';

  const elapsedMs = Math.max(0, now.getTime() - parsedDate.getTime());
  if (elapsedMs < 30_000) return 'Just now';

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}
