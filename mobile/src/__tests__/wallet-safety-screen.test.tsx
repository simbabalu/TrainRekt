import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import WalletSafetyScreen from '@/app/wallet-safety';

const useWalletMock = vi.hoisted(() => vi.fn());
const useWalletSnapshotMock = vi.hoisted(() => vi.fn());
const useWalletSafetyInspectionMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

vi.mock('@/hooks/useWalletSnapshot', () => ({
  useWalletSnapshot: useWalletSnapshotMock,
}));

vi.mock('@/hooks/useWalletSafetyInspection', () => ({
  useWalletSafetyInspection: useWalletSafetyInspectionMock,
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

vi.mock('@/components/wallet/WalletSafetyInspection', () => ({
  WalletSafetyInspection: ({ status, error }: { status: string; error: string | null }) => React.createElement('Text', null, `INSPECTION status=${status} error=${error ?? 'none'}`),
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

    useWalletSafetyInspectionMock.mockReturnValue({
      isConnected: false,
      status: 'idle',
      viewMode: 'review',
      inspection: null,
      error: null,
      setViewMode: vi.fn(),
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletSafetyScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('WALLET SAFETY Read-only wallet snapshot');
    expect(text).toContain('CARD connected=false status=idle network=mainnet-beta');
    expect(text).toContain('INSPECTION status=idle error=none');
    expect(text).toContain('does not classify assets as safe or unsafe');
  });

  it('keeps snapshot visible when inspection is unavailable', () => {
    useWalletMock.mockReturnValue({
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect: vi.fn(),
    });

    useWalletSnapshotMock.mockReturnValue({
      isConnected: true,
      status: 'success',
      snapshot: {
        address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
        network: 'mainnet-beta',
        solBalanceLamports: 1_000_000_000n,
        tokenAccountCount: 1,
        nonZeroTokenAccountCount: 1,
        zeroBalanceTokenAccountCount: 0,
        fetchedAt: new Date().toISOString(),
      },
      error: null,
      network: 'mainnet-beta',
      refresh: vi.fn(),
    });

    useWalletSafetyInspectionMock.mockReturnValue({
      isConnected: true,
      status: 'unavailable',
      viewMode: 'review',
      inspection: null,
      error: 'Wallet inspection is temporarily unavailable. Please try again.',
      setViewMode: vi.fn(),
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletSafetyScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('CARD connected=true status=success network=mainnet-beta');
    expect(text).toContain('INSPECTION status=unavailable error=Wallet inspection is temporarily unavailable. Please try again.');
  });
});
