import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import SettingsScreen from '@/app/settings';

Object.defineProperty(globalThis, '__DEV__', {
  value: false,
  configurable: true,
});

const useSettingsMock = vi.hoisted(() => vi.fn());
const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const useWalletMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useSettings', () => ({
  useSettings: useSettingsMock,
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: useTrainingProgressMock,
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/PageHeading', () => ({
  PageHeading: () => null,
}));

vi.mock('@/components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Switch: 'Switch',
  Text: 'Text',
  View: 'View',
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

function setupDefaultMocks() {
  useSettingsMock.mockReturnValue({
    settings: {
      difficulty: 'Intermediate',
      notificationsEnabled: true,
      soundEffectsEnabled: true,
      hapticFeedbackEnabled: true,
    },
    setDifficulty: vi.fn(),
    setPreference: vi.fn(),
    resetSettings: vi.fn(),
  });

  useTrainingProgressMock.mockReturnValue({
    resetProgress: vi.fn(),
    debugSimulatePreviousDay: vi.fn(),
  });
}

describe('SettingsScreen wallet card', () => {
  it('renders wallet label prominently, base58 abbreviation, connected status, and disconnect action', () => {
    setupDefaultMocks();
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: {
        label: 'pascalschaer.skr',
        address: '51SYwT7hXpnYccF6Uabvwp7mQkY6MoBVVqf3v83oJZ',
      },
      error: null,
      realMessageSigningEnabled: false,
      trainingSigningMessage: {
        nonce: '001122334455',
        displayMessage: 'TrainRekt Wallet Safety Training\n\nTraining nonce: 001122334455',
        messageBytes: new Uint8Array([1, 2]),
      },
      signingStatus: 'idle',
      signingError: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTrainingMessage: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SettingsScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('WALLET');
    expect(text).toContain('pascalschaer.skr');
    expect(text).toContain('51SY...3oJZ');
    expect(text).toContain('Connected');
    expect(text).toContain('Disconnect');
    expect(text).not.toContain('04uf...Ubl=');
  });

  it('falls back to abbreviated canonical address when label is missing', () => {
    setupDefaultMocks();
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: {
        address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq',
      },
      error: null,
      realMessageSigningEnabled: false,
      trainingSigningMessage: {
        nonce: '001122334455',
        displayMessage: 'TrainRekt Wallet Safety Training\n\nTraining nonce: 001122334455',
        messageBytes: new Uint8Array([1, 2]),
      },
      signingStatus: 'idle',
      signingError: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTrainingMessage: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SettingsScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('7xKs...k9Wq');
    expect(text).toContain('Connected');
    expect(text).not.toContain('undefined');
  });

  it('renders settings row labels, supporting descriptions, and interactive controls', () => {
    setupDefaultMocks();
    useWalletMock.mockReturnValue({
      status: 'connected',
      wallet: {
        label: 'pascalschaer.skr',
        address: '51SYwT7hXpnYccF6Uabvwp7mQkY6MoBVVqf3v83oJZ',
      },
      error: null,
      realMessageSigningEnabled: false,
      trainingSigningMessage: {
        nonce: '001122334455',
        displayMessage: 'TrainRekt Wallet Safety Training\n\nTraining nonce: 001122334455',
        messageBytes: new Uint8Array([1, 2]),
      },
      signingStatus: 'idle',
      signingError: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTrainingMessage: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SettingsScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('Training difficulty');
    expect(text).toContain('Adjust the challenge level');
    expect(text).toContain('Notifications');
    expect(text).toContain('Get reminders and updates');
    expect(text).toContain('Sound effects');
    expect(text).toContain('Play feedback sounds');
    expect(text).toContain('Haptic feedback');
    expect(text).toContain('Feel interactions');
    expect(text).toContain('Reset');
    expect(text).toContain('Reset training progress');
    expect(text).toContain('Disconnect');
    expect(text).toContain('Real wallet training');
    expect(text).toContain('REAL SIGNING DISABLED');
    expect(text).toContain('TrainRekt Wallet Safety Training');
    expect(text).not.toContain('Sign with real wallet');

    const switches = renderer.root.findAll((node) => String(node.type) === 'Switch');

    expect(switches.length).toBeGreaterThanOrEqual(3);
  });
});
