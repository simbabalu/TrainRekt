import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { WalletSafetySnapshotCard } from './WalletSafetySnapshotCard';

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, children)),
}));

vi.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

describe('WalletSafetySnapshotCard', () => {
  it('shows disconnected CTA with read-only messaging', () => {
    const onConnect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <WalletSafetySnapshotCard
          wallet={null}
          connected={false}
          network="mainnet-beta"
          status="idle"
          snapshot={null}
          error={null}
          onConnect={onConnect}
          onRefresh={vi.fn()}
        />,
      );
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('WALLET SAFETY');
    expect(text).toContain('READ ONLY');
    expect(text).toContain('No signature required');
    expect(text).toContain('Connect a wallet to run a read-only safety check.');
    expect(text).toContain('CONNECT WALLET');

    const connectButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      connectButton.props.onPress();
    });

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('renders snapshot metrics and refresh action while connected', () => {
    const onRefresh = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <WalletSafetySnapshotCard
          wallet={{ label: 'pascalschaer.skr', address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' }}
          connected
          network="mainnet-beta"
          status="success"
          snapshot={{
            address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
            network: 'mainnet-beta',
            solBalanceLamports: 1_284_000_000n,
            tokenAccountCount: 14,
            nonZeroTokenAccountCount: 8,
            zeroBalanceTokenAccountCount: 6,
            fetchedAt: new Date().toISOString(),
          }}
          error={null}
          onConnect={vi.fn()}
          onRefresh={onRefresh}
        />,
      );
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('pascalschaer.skr');
    expect(text).toContain('mainnet-beta');
    expect(text).toContain('1.284 SOL');
    expect(text).toContain('14');
    expect(text).toContain('8');
    expect(text).toContain('6');
    expect(text).toContain('REFRESH');

    const pressables = renderer.root.findAll((node) => String(node.type) === 'Pressable');
    const refreshButton = pressables[0];
    act(() => {
      refreshButton.props.onPress();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows loading and retry states', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <WalletSafetySnapshotCard
          wallet={{ address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' }}
          connected
          network="mainnet-beta"
          status="loading"
          snapshot={null}
          error={null}
          onConnect={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );
    });

    expect(renderedText(renderer.toJSON())).toContain('REFRESHING...');

    act(() => {
      renderer.update(
        <WalletSafetySnapshotCard
          wallet={{ address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' }}
          connected
          network="mainnet-beta"
          status="error"
          snapshot={null}
          error="Wallet snapshot is temporarily unavailable. Please try again."
          onConnect={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('Wallet snapshot is temporarily unavailable. Please try again.');
    expect(text).toContain('RETRY');
  });
});
