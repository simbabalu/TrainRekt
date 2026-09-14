import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareIntentCoordinator, __resetShareIntentCoordinatorStateForTests } from '@/components/share/ShareIntentCoordinator';

const pushMock = vi.hoisted(() => vi.fn());
const resetShareIntentMock = vi.hoisted(() => vi.fn());
const shareIntentHookMock = vi.hoisted(() => vi.fn());

interface ShareIntentHookState {
  hasShareIntent: boolean;
  shareIntent: {
    text: string | null;
    webUrl: string | null;
    meta: { title?: string } | null;
    type: string | null;
    files: null;
  };
  resetShareIntent: () => void;
}

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('expo-share-intent', () => ({
  useShareIntent: () => shareIntentHookMock(),
}));

describe('ShareIntentCoordinator', () => {
  beforeEach(() => {
    pushMock.mockReset();
    resetShareIntentMock.mockReset();
    __resetShareIntentCoordinatorStateForTests();
  });

  it('handles cold-start share payload and routes to token analysis with autoAnalyze', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    shareIntentHookMock.mockReturnValue({
      hasShareIntent: true,
      shareIntent: {
        text: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        webUrl: null,
        meta: null,
        type: 'text',
        files: null,
      },
      resetShareIntent: resetShareIntentMock,
    });

    act(() => {
      create(<ShareIntentCoordinator />);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/token-analysis',
      params: {
        mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        shareEventId: 'share-1000-1',
        autoAnalyze: '1',
      },
    });
    expect(resetShareIntentMock).toHaveBeenCalledTimes(1);
  });

  it('handles a warm-app share when intent appears after initial render', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(2000);

    let state: ShareIntentHookState = {
      hasShareIntent: false,
      shareIntent: {
        text: null,
        webUrl: null,
        meta: null,
        type: null,
        files: null,
      },
      resetShareIntent: resetShareIntentMock,
    };

    shareIntentHookMock.mockImplementation(() => state);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ShareIntentCoordinator />);
    });

    expect(pushMock).not.toHaveBeenCalled();

    state = {
      hasShareIntent: true,
      shareIntent: {
        text: 'My token https://pump.fun/coin/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        webUrl: null,
        meta: { title: 'Pump token' },
        type: 'text',
        files: null,
      },
      resetShareIntent: resetShareIntentMock,
    };

    nowSpy.mockReturnValue(2001);
    act(() => {
      renderer.update(<ShareIntentCoordinator />);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(resetShareIntentMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates duplicate share delivery and does not navigate twice', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(3000);

    let state: ShareIntentHookState = {
      hasShareIntent: true,
      shareIntent: {
        text: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        webUrl: null,
        meta: null,
        type: 'text',
        files: null,
      },
      resetShareIntent: resetShareIntentMock,
    };

    shareIntentHookMock.mockImplementation(() => state);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ShareIntentCoordinator />);
    });

    state = {
      hasShareIntent: true,
      shareIntent: {
        text: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        webUrl: null,
        meta: null,
        type: 'text',
        files: null,
      },
      resetShareIntent: resetShareIntentMock,
    };

    nowSpy.mockReturnValue(3001);
    act(() => {
      renderer.update(<ShareIntentCoordinator />);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(resetShareIntentMock).toHaveBeenCalledTimes(2);
  });
});
