import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { WalletSafetyInspection } from '@/types/walletInspection';
import { HomeWalletSafetyCard } from './HomeWalletSafetyCard';

const useWalletMock = vi.hoisted(() => vi.fn());
const useWalletSafetyInspectionMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

vi.mock('@/hooks/useWalletSafetyInspection', () => ({
  useWalletSafetyInspection: useWalletSafetyInspectionMock,
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/services/wallet/mobileWalletService', () => ({
  mobileWalletService: walletServiceMock,
}));

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, children)),
}));

vi.mock('@/components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

vi.mock('@/components/AppIcon', () => ({
  AppIcon: () => React.createElement('View', null),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function flattenText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return flattenText(value.children);
  return '';
}

function createInspection(accounts: WalletSafetyInspection['tokenAccounts']): WalletSafetyInspection {
  return {
    address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
    network: 'mainnet-beta',
    inspectedAt: new Date().toISOString(),
    warnings: [],
    mintInspections: [],
    tokenAccounts: accounts,
  };
}

describe('HomeWalletSafetyCard', () => {
  beforeEach(() => {
    pushMock.mockReset();
    walletServiceMock.connectWallet.mockReset();
    useWalletMock.mockReset();
    useWalletSafetyInspectionMock.mockReset();
  });

  it('renders disconnected state with CONNECT WALLET', () => {
    useWalletMock.mockReturnValue({
      status: 'disconnected',
      wallet: null,
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: null,
      inspection: null,
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('WALLET SAFETY');
    expect(text).toContain('CONNECT WALLET');
  });

  it('CONNECT WALLET invokes WalletContext connect and does not call MWA directly', () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    useWalletMock.mockReturnValue({
      status: 'disconnected',
      wallet: null,
      connect,
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: null,
      inspection: null,
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const connectButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      connectButton.props.onPress();
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
  });

  it('uses wallet inspection hook with autoFetch disabled on Home', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect: vi.fn(),
    });
    const refresh = vi.fn();
    useWalletSafetyInspectionMock.mockReturnValue({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
      inspection: null,
      refresh,
    });

    act(() => {
      create(<HomeWalletSafetyCard />);
    });

    expect(useWalletSafetyInspectionMock).toHaveBeenCalledWith({ autoFetch: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('connected without inspection shows Wallet connected and CHECK WALLET', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
      inspection: null,
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Wallet connected');
    expect(text).toContain('CHECK WALLET');
  });

  it('CHECK WALLET navigates to /wallet-safety', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
      inspection: null,
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const cardPressable = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      cardPressable.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith('/wallet-safety');
  });

  it('connected with inspection shows Need Review and Informational counts', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
      refresh: vi.fn(),
      inspection: createInspection([
        {
          tokenAccountAddress: 'review-1',
          mintAddress: 'mint-1',
          program: 'token-2022',
          rawAmount: '5',
          decimals: 0,
          uiAmount: 5,
          state: 'frozen',
          delegateAddress: null,
          delegatedAmountRaw: null,
          closeAuthorityAddress: null,
        },
        {
          tokenAccountAddress: 'informational-1',
          mintAddress: 'mint-2',
          program: 'token-2022',
          rawAmount: '1',
          decimals: 0,
          uiAmount: 1,
          state: 'initialized',
          delegateAddress: null,
          delegatedAmountRaw: null,
          closeAuthorityAddress: null,
        },
      ]),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('1');
    expect(text).toContain('NEED REVIEW');
    expect(text).toContain('INFORMATIONAL');
    expect(text).toContain('REVIEW WALLET');
  });

  it('does not show balances, prices, account list, or technical breakdown on Home card', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
      refresh: vi.fn(),
      inspection: createInspection([]),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const text = flattenText(renderer.toJSON());
    expect(text).not.toContain('SOL');
    expect(text).not.toContain('price');
    expect(text).not.toContain('portfolio');
    expect(text).not.toContain('Technical breakdown');
    expect(text).not.toContain('TOKEN ACCOUNT');
  });

  it('tapping inspected card navigates to /wallet-safety', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
      refresh: vi.fn(),
      inspection: createInspection([]),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const cardPressable = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      cardPressable.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith('/wallet-safety');
  });

  it('disconnect hides previous wallet inspection summary', () => {
    const connect = vi.fn();
    const connectedWalletState = {
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH' },
      connect,
    };
    const disconnectedWalletState = {
      status: 'disconnected',
      wallet: null,
      connect,
    };

    useWalletMock.mockReturnValue(connectedWalletState);
    useWalletSafetyInspectionMock.mockReturnValue({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
      refresh: vi.fn(),
      inspection: createInspection([
        {
          tokenAccountAddress: 'review-1',
          mintAddress: 'mint-1',
          program: 'spl-token',
          rawAmount: '2',
          decimals: 0,
          uiAmount: 2,
          state: 'frozen',
          delegateAddress: null,
          delegatedAmountRaw: null,
          closeAuthorityAddress: null,
        },
      ]),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    expect(flattenText(renderer.toJSON())).toContain('NEED REVIEW');

    useWalletMock.mockReturnValue(disconnectedWalletState);
    useWalletSafetyInspectionMock.mockReturnValue({
      address: null,
      refresh: vi.fn(),
      inspection: null,
    });

    act(() => {
      renderer.update(<HomeWalletSafetyCard />);
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('CONNECT WALLET');
    expect(text).not.toContain('NEED REVIEW');
  });

  it('wallet address change does not show old wallet inspection summary', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: 'wallet-a' },
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: 'wallet-a',
      refresh: vi.fn(),
      inspection: createInspection([
        {
          tokenAccountAddress: 'review-1',
          mintAddress: 'mint-1',
          program: 'spl-token',
          rawAmount: '2',
          decimals: 0,
          uiAmount: 2,
          state: 'frozen',
          delegateAddress: null,
          delegatedAmountRaw: null,
          closeAuthorityAddress: null,
        },
      ]),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });
    expect(flattenText(renderer.toJSON())).toContain('NEED REVIEW');

    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: 'wallet-b' },
      connect: vi.fn(),
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: 'wallet-b',
      refresh: vi.fn(),
      inspection: null,
    });

    act(() => {
      renderer.update(<HomeWalletSafetyCard />);
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('CHECK WALLET');
    expect(text).not.toContain('NEED REVIEW');
  });

  it('connecting from Home uses WalletContext transition path', () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    useWalletMock.mockReturnValue({
      status: 'disconnected',
      wallet: null,
      connect,
    });
    useWalletSafetyInspectionMock.mockReturnValue({
      address: null,
      inspection: null,
      refresh: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeWalletSafetyCard />);
    });

    const connectButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      connectButton.props.onPress();
    });

    expect(connect).toHaveBeenCalledTimes(1);
  });

});
