import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import WalletSafetyScreen from '@/app/wallet-safety';

const useWalletMock = vi.hoisted(() => vi.fn());
const useWalletSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

vi.mock('@/hooks/useWalletSnapshot', () => ({
  useWalletSnapshot: useWalletSnapshotMock,
}));

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/PageHeading', () => ({
  PageHeading: ({ eyebrow, title }: { eyebrow: string; title: string }) => React.createElement('Text', null, `${eyebrow} ${title}`),
}));

vi.mock('@/components/WalletSafetySnapshotCard', () => ({
  WalletSafetySnapshotCard: ({ connected, status, network }: { connected: boolean; status: string; network: string }) => React.createElement('Text', null, `CARD connected=${connected} status=${status} network=${network}`),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

describe('WalletSafetyScreen', () => {
  it('renders dedicated screen heading and snapshot card', () => {
    useWalletMock.mockReturnValue({
      wallet: null,
      connect: vi.fn(),
    });

    useWalletSnapshotMock.mockReturnValue({
      isConnected: false,
      status: 'idle',
      snapshot: null,
      error: null,
      network: 'mainnet-beta',
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletSafetyScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('WALLET SAFETY Read-only wallet snapshot');
    expect(text).toContain('CARD connected=false status=idle network=mainnet-beta');
    expect(text).toContain('does not classify assets as safe or unsafe');
  });
});
