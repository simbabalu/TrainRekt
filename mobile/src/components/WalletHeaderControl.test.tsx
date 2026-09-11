import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { WalletHeaderControl } from './WalletHeaderControl';

const useWalletMock = vi.hoisted(() => vi.fn());
const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  signMessage: vi.fn(),
  authorize: vi.fn(),
  reauthorize: vi.fn(),
  signMessages: vi.fn(),
  signTransactions: vi.fn(),
  signAndSendTransactions: vi.fn(),
  sendTransaction: vi.fn(),
  submitTransaction: vi.fn(),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

vi.mock('@/services/wallet/mobileWalletService', () => ({
  mobileWalletService: walletServiceMock,
}));

vi.mock('react-native', () => ({
  Modal: ({ children, visible }: { children: React.ReactNode; visible?: boolean }) => visible ? React.createElement('View', null, children) : null,
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

describe('WalletHeaderControl', () => {
  it('shows CONNECT while disconnected', () => {
    useWalletMock.mockReturnValue({
      status: 'disconnected',
      wallet: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletHeaderControl />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('CONNECT');

    const connectButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Connect wallet');
    expect(connectButton.props.accessibilityRole).toBe('button');
    expect(connectButton.props.accessibilityState).toEqual({ disabled: false });
  });

  it('shows CONNECTING and disables interaction while connecting', () => {
    useWalletMock.mockReturnValue({
      status: 'connecting',
      wallet: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletHeaderControl />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('CONNECTING...');

    const stateNode = renderer.root.find((node) => node.props.accessibilityLabel === 'Wallet connecting');
    expect(stateNode.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it('shows wallet label when connected and opens menu without immediate disconnect', () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { label: 'pascalschaer.skr', address: '51SYwT7hXpnYccF6Uabvwp7mQkY6MoBVVqf3v83oJZ' },
      connect: vi.fn(),
      disconnect,
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletHeaderControl />);
    });

    const trigger = renderer.root.find((node) => node.props.accessibilityLabel === 'Wallet connected: pascalschaer.skr');
    expect(renderedText(renderer.toJSON())).toMatch(/pascalschaer\.skr\s+v/);

    act(() => {
      trigger.props.onPress();
    });

    const menuText = renderedText(renderer.toJSON());
    expect(menuText).toContain('CONNECTED WALLET');
    expect(menuText).toContain('pascalschaer.skr');
    expect(menuText).toContain('51SY...3oJZ');
    expect(disconnect).not.toHaveBeenCalled();

    const disconnectButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Disconnect wallet');
    act(() => {
      disconnectButton.props.onPress();
    });

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to abbreviated address in connected header label when wallet label is unavailable', () => {
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq' },
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletHeaderControl />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toMatch(/7xKs\.\.\.k9Wq\s+v/);
    const trigger = renderer.root.find((node) => node.props.accessibilityLabel === 'Wallet connected: 7xKs...k9Wq');
    expect(trigger.props.accessibilityRole).toBe('button');
  });

  it('never calls wallet service methods directly from header UI interactions', () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    useWalletMock.mockReturnValue({
      status: 'disconnected',
      wallet: null,
      connect,
      disconnect: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<WalletHeaderControl />);
    });

    const connectButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Connect wallet');
    act(() => {
      connectButton.props.onPress();
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
  });
});
