import { describe, expect, it } from 'vitest';

import { formatWalletSnapshotTime } from './formatWalletSnapshotTime';

describe('formatWalletSnapshotTime', () => {
  const now = new Date('2026-09-11T10:00:00.000Z');

  it('formats relative timestamps for wallet snapshot checks', () => {
    expect(formatWalletSnapshotTime('2026-09-11T09:59:45.000Z', now)).toBe('Just now');
    expect(formatWalletSnapshotTime('2026-09-11T09:59:20.000Z', now)).toBe('40s ago');
    expect(formatWalletSnapshotTime('2026-09-11T09:20:00.000Z', now)).toBe('40m ago');
    expect(formatWalletSnapshotTime('2026-09-11T08:00:00.000Z', now)).toBe('2h ago');
    expect(formatWalletSnapshotTime('2026-09-09T10:00:00.000Z', now)).toBe('2d ago');
  });

  it('returns unavailable for malformed timestamps', () => {
    expect(formatWalletSnapshotTime('not-a-date', now)).toBe('Unavailable');
  });
});
