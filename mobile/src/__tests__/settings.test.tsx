import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import SettingsScreen from '@/app/(tabs)/settings';

Object.defineProperty(globalThis, '__DEV__', {
  value: false,
  configurable: true,
});

const useSettingsMock = vi.hoisted(() => vi.fn());
const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const useWalletMock = vi.hoisted(() => vi.fn());
const useSurpriseChallengeMock = vi.hoisted(() => vi.fn());
const alertMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useSettings', () => ({
  useSettings: useSettingsMock,
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: useTrainingProgressMock,
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

vi.mock('@/hooks/useSurpriseChallenge', () => ({
  useSurpriseChallenge: useSurpriseChallengeMock,
}));

vi.mock('@/constants/debug', () => ({
  DEV_EXERCISE_PICKER_ENABLED: true,
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
  Alert: { alert: alertMock },
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
    progress: {
      surpriseChallenges: {
        completed: {},
      },
    },
    resetProgress: vi.fn(),
    debugSimulatePreviousDay: vi.fn(),
  });

  useSurpriseChallengeMock.mockReturnValue({
    startPreview: vi.fn(),
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
    expect(text).not.toContain('Disconnect');
    expect(text).not.toContain('Connect Wallet');
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

  it('renders compact production settings without unwired preferences or signing diagnostics', () => {
    setupDefaultMocks();
    const signMessages = vi.fn();
    const signTransactions = vi.fn();
    const signAndSendTransactions = vi.fn();
    const deauthorize = vi.fn();
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
      signMessages,
      signTransactions,
      signAndSendTransactions,
      deauthorize,
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SettingsScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('TRAINING');
    expect(text).toContain('Training difficulty');
    expect(text).not.toContain('Notifications');
    expect(text).not.toContain('Sound effects');
    expect(text).not.toContain('Haptic feedback');
    expect(text).toContain('DATA');
    expect(text).toContain('Reset training progress');
    expect(text).not.toContain('Disconnect');
    expect(text).toContain('REAL WALLET TRAINING');
    expect(text).toContain('Real message signing is currently disabled.');
    expect(text).toContain('LEARN MORE');
    expect(text).not.toContain('001122334455');
    expect(text).not.toContain('TrainRekt Wallet Safety Training');
    expect(text).not.toContain('DEVELOPER TOOLS');

    const learnMore = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    expect(learnMore).toBeDefined();
    act(() => {
      learnMore?.props.onPress();
    });
    expect(renderedText(renderer.toJSON())).toContain('This simulator does not request a real signature');
    expect(useWalletMock.mock.results[0]?.value.signTrainingMessage).not.toHaveBeenCalled();
    expect(signMessages).not.toHaveBeenCalled();
    expect(signTransactions).not.toHaveBeenCalled();
    expect(signAndSendTransactions).not.toHaveBeenCalled();
    expect(deauthorize).not.toHaveBeenCalled();
  });

  it('keeps difficulty selection interactive and routes reset actions through confirmation', () => {
    setupDefaultMocks();
    const setDifficulty = vi.fn();
    const resetProgress = vi.fn();
    const resetSettings = vi.fn();
    useSettingsMock.mockReturnValue({
      settings: { difficulty: 'Intermediate', notificationsEnabled: true, soundEffectsEnabled: true, hapticFeedbackEnabled: true },
      setDifficulty,
      setPreference: vi.fn(),
      resetSettings,
    });
    useTrainingProgressMock.mockReturnValue({
      progress: { surpriseChallenges: { completed: {} } },
      resetProgress,
      debugSimulatePreviousDay: vi.fn(),
    });
    useWalletMock.mockReturnValue({
      status: 'disconnected', wallet: null, error: null, realMessageSigningEnabled: false,
      trainingSigningMessage: { nonce: '001122334455', displayMessage: 'hidden', messageBytes: new Uint8Array([1]) },
      signingStatus: 'idle', signingError: null, connect: vi.fn(), disconnect: vi.fn(), signTrainingMessage: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SettingsScreen />);
    });

    const pressables = renderer.root.findAll((node) => String(node.type) === 'Pressable');
    act(() => {
      pressables[3]?.props.onPress();
      pressables[4]?.props.onPress();
    });
    expect(setDifficulty).toHaveBeenCalledWith('Advanced');
    expect(alertMock).toHaveBeenCalledTimes(1);
    const progressResetAction = alertMock.mock.calls[0][2].find((action: { text: string }) => action.text === 'Reset');
    act(() => {
      progressResetAction.onPress();
    });
    expect(resetProgress).toHaveBeenCalledTimes(1);

    act(() => {
      pressables[5]?.props.onPress();
    });
    expect(alertMock).toHaveBeenCalledTimes(2);
    const settingsResetAction = alertMock.mock.calls[1][2].find((action: { text: string }) => action.text === 'Reset');
    act(() => {
      settingsResetAction.onPress();
    });
    expect(resetSettings).toHaveBeenCalledTimes(1);
  });

  it('exposes developer tools only when DEV and the explicit feature flag are enabled', () => {
    setupDefaultMocks();
    useWalletMock.mockReturnValue({
      status: 'disconnected',
      wallet: null,
      error: null,
      realMessageSigningEnabled: false,
      trainingSigningMessage: { nonce: '001122334455', displayMessage: 'TrainRekt Wallet Safety Training', messageBytes: new Uint8Array([1, 2]) },
      signingStatus: 'idle',
      signingError: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTrainingMessage: vi.fn(),
    });

    Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SettingsScreen />);
    });

    expect(renderedText(renderer.toJSON())).toContain('DEVELOPER TOOLS');
    Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
  });
});
