import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { useTokenAnalysis } from './useTokenAnalysis';
import type { TokenInspectionApiService } from '@/services/api/tokenInspectionApiService';
import type { TokenInspectionResponse, TokenIdentityProvenanceResponse, TokenInspectionCoachResponse } from '@/types/tokenAnalysis';

type Controller = ReturnType<typeof useTokenAnalysis>;

function createInspection(): TokenInspectionResponse {
  return {
    identity: { mint: 'Mint1111111111111111111111111111111111', name: 'Token', symbol: 'TOK' },
    authorities: { mintAuthorityRevoked: true, freezeAuthorityRevoked: true, mintAuthority: null, freezeAuthority: null },
    program: { programId: 'Tokenkeg', programType: 'spl-token' },
    age: { ageSeconds: 1000, isReliable: true, unavailableReason: null },
    holderConcentration: {
      topHolderPercentage: 12,
      top5HoldersPercentage: 30,
      top10HoldersPercentage: 45,
      semanticsNote: 'note',
      unclassifiedTokenAccountConcentration: null,
    },
    largestTokenAccounts: [],
    reviewSignals: [],
    inspectedAtUtc: new Date().toISOString(),
  };
}

function createProvenance(): TokenIdentityProvenanceResponse {
  return {
    result: 'COLLISION_OBSERVED',
    confidence: 'MEDIUM',
    scannedIdentity: { mint: 'Mint1111111111111111111111111111111111', rawName: null, normalizedName: null, rawSymbol: null, normalizedSymbol: null, observedAtUtc: new Date().toISOString() },
    earliestObservedMatch: null,
    collisions: [],
    totalCollisionCount: 0,
    returnedCollisionCount: 0,
    isTruncated: false,
    evidence: [],
    conflictingEvidence: [],
    unknowns: [],
    analyzedAtUtc: new Date().toISOString(),
    onChainChronology: null,
    trustedIdentityProvenance: null,
    identityClassification: {
      classification: 'NO_COLLISION_EVIDENCE',
      confidence: 'MEDIUM',
      relevantCompetingMint: null,
      evidence: [],
      limitations: [],
    },
  };
}

function createCoach(available = true): TokenInspectionCoachResponse {
  return {
    available,
    status: available ? 'available' : 'unavailable',
    coach: available ? {
      summary: 'summary',
      riskExplanations: ['risk'],
      whatToCheckNext: ['check'],
      uncertainty: ['uncertain'],
      recommendedTrainingTopicId: 'token-account-state',
      coachVersion: 2,
      generatedAtUtc: new Date().toISOString(),
    } : null,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderHook(service: TokenInspectionApiService): { getController: () => Controller; unmount: () => void } {
  let controller!: Controller;

  function Harness() {
    controller = useTokenAnalysis({ service });
    return null;
  }

  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<Harness />);
  });

  return {
    getController: () => controller,
    unmount: () => renderer.unmount(),
  };
}

describe('useTokenAnalysis', () => {
  it('requests AI coach automatically after analyzeToken succeeds', async () => {
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(service.inspectToken).toHaveBeenCalledTimes(1);
    expect(service.getProvenance).toHaveBeenCalledTimes(1);
    expect(service.getCoach).toHaveBeenCalledTimes(1);
  });

  it('allows explicit retry action after auto-load', async () => {
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(service.getCoach).toHaveBeenCalledTimes(1);

    await act(async () => {
      await getController().explainWithAi();
    });

    expect(service.getCoach).toHaveBeenCalledTimes(2);
    expect(getController().aiStatus).toBe('ready');
    expect(getController().coach?.summary).toBe('summary');
  });

  it('keeps deterministic report visible when AI is unavailable', async () => {
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach(false)),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().deterministicStatus).toBe('ready');
    expect(getController().report).not.toBeNull();
    expect(getController().aiStatus).toBe('unavailable');
  });

  it('handles provenance failure as partial deterministic success', async () => {
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockRejectedValue(new Error('provenance offline')),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().deterministicStatus).toBe('ready');
    expect(getController().report?.inspection.identity.mint).toBe('Mint1111111111111111111111111111111111');
    expect(getController().report?.provenance).toBeNull();
    expect(getController().report?.provenanceWarning).toContain('offline');
  });

  it('resets report and statuses when clearInput is invoked', async () => {
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().report).not.toBeNull();

    await act(async () => {
      getController().clearInput();
    });

    expect(getController().mintInput).toBe('');
    expect(getController().report).toBeNull();
    expect(getController().deterministicStatus).toBe('idle');
    expect(getController().aiStatus).toBe('idle');
  });

  it('clears stale report when validation fails for a new mint input', async () => {
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().report).not.toBeNull();

    await act(async () => {
      getController().setMintInput('bad');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().report).toBeNull();
    expect(getController().deterministicStatus).toBe('error');
    expect(getController().validationError).toContain('valid Solana mint format');
  });

  it('starts exactly one automatic coach request while analyze is successful', async () => {
    let resolveCoach!: (value: TokenInspectionCoachResponse) => void;
    const pendingCoach = new Promise<TokenInspectionCoachResponse>((resolve) => {
      resolveCoach = resolve;
    });

    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockReturnValue(pendingCoach),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().aiStatus).toBe('loading');
    expect(getController().report?.inspection.identity.mint).toBe('Mint1111111111111111111111111111111111');
    expect(service.getCoach).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCoach(createCoach(true));
      await Promise.resolve();
    });

    expect(getController().aiStatus).toBe('ready');
    expect(getController().coach?.summary).toBe('summary');
    expect(getController().report).not.toBeNull();
  });

  it('keeps deterministic result visible when automatic coach request resolves unavailable', async () => {
    let resolveCoach!: (value: TokenInspectionCoachResponse) => void;
    const pendingCoach = new Promise<TokenInspectionCoachResponse>((resolve) => {
      resolveCoach = resolve;
    });

    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockReturnValue(pendingCoach),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().aiStatus).toBe('loading');
    expect(service.getCoach).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCoach(createCoach(false));
      await Promise.resolve();
    });

    expect(getController().aiStatus).toBe('unavailable');
    expect(getController().report).not.toBeNull();
  });

  it('clears previous report immediately when a second analysis starts, then shows the new result', async () => {
    let resolveSecondInspect!: (value: TokenInspectionResponse) => void;
    const secondInspect = new Promise<TokenInspectionResponse>((resolve) => {
      resolveSecondInspect = resolve;
    });

    let inspectCallCount = 0;
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockImplementation(async () => {
        inspectCallCount += 1;
        if (inspectCallCount === 1) return createInspection();
        return secondInspect;
      }),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });

    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().deterministicStatus).toBe('ready');
    expect(getController().report?.mint).toBe('Mint1111111111111111111111111111111111');

    await act(async () => {
      getController().setMintInput('So11111111111111111111111111111111111111112');
    });

    let pendingCall!: Promise<void>;
    act(() => {
      pendingCall = getController().analyzeToken();
    });

    expect(getController().deterministicStatus).toBe('loadingInspection');
    expect(getController().report).toBeNull();

    await act(async () => {
      resolveSecondInspect({
        ...createInspection(),
        identity: {
          ...createInspection().identity,
          mint: 'So11111111111111111111111111111111111111112',
        },
      });
      await pendingCall;
    });

    expect(getController().deterministicStatus).toBe('ready');
    expect(getController().report?.mint).toBe('So11111111111111111111111111111111111111112');
  });

  it('keeps previous report cleared when a second analysis fails', async () => {
    let inspectCallCount = 0;
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockImplementation(async () => {
        inspectCallCount += 1;
        if (inspectCallCount === 1) return createInspection();
        throw new Error('second request failed');
      }),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });
    await act(async () => {
      await getController().analyzeToken();
    });
    expect(getController().report).not.toBeNull();

    await act(async () => {
      getController().setMintInput('So11111111111111111111111111111111111111112');
    });
    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().deterministicStatus).toBe('error');
    expect(getController().report).toBeNull();
    expect(getController().deterministicError).toContain('second request failed');
  });

  it('aborts the previous analysis and ignores its late response', async () => {
    const firstInspection = deferred<TokenInspectionResponse>();
    const secondInspection = deferred<TokenInspectionResponse>();
    const signals: AbortSignal[] = [];
    let inspectCallCount = 0;
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockImplementation((_request, signal?: AbortSignal) => {
        signals.push(signal!);
        inspectCallCount += 1;
        return inspectCallCount === 1 ? firstInspection.promise : secondInspection.promise;
      }),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockResolvedValue(createCoach()),
    };

    const { getController } = renderHook(service);

    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });
    let firstCall!: Promise<void>;
    act(() => {
      firstCall = getController().analyzeToken();
    });

    await act(async () => {
      getController().setMintInput('So11111111111111111111111111111111111111112');
    });
    let secondCall!: Promise<void>;
    act(() => {
      secondCall = getController().analyzeToken();
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    secondInspection.resolve({
      ...createInspection(),
      identity: { ...createInspection().identity, mint: 'So11111111111111111111111111111111111111112' },
    });
    await act(async () => {
      await secondCall;
    });

    firstInspection.resolve(createInspection());
    await act(async () => {
      await firstCall;
    });

    expect(getController().report?.mint).toBe('So11111111111111111111111111111111111111112');
    expect(getController().deterministicError).toBeNull();
  });

  it('aborts an in-flight coach request when a new analysis starts', async () => {
    const secondInspection = deferred<TokenInspectionResponse>();
    const coachResponse = deferred<TokenInspectionCoachResponse>();
    let inspectCallCount = 0;
    let coachSignal!: AbortSignal;
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockImplementation(() => {
        inspectCallCount += 1;
        return inspectCallCount === 1 ? Promise.resolve(createInspection()) : secondInspection.promise;
      }),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockImplementation((_mint, signal?: AbortSignal) => {
        coachSignal = signal!;
        return coachResponse.promise;
      }),
    };

    const { getController } = renderHook(service);
    await act(async () => {
      getController().setMintInput('Mint1111111111111111111111111111111111');
    });
    await act(async () => {
      await getController().analyzeToken();
    });

    expect(getController().aiStatus).toBe('loading');

    await act(async () => {
      getController().setMintInput('So11111111111111111111111111111111111111112');
    });
    let secondAnalysis!: Promise<void>;
    act(() => {
      secondAnalysis = getController().analyzeToken();
    });

    expect(coachSignal.aborted).toBe(true);

    secondInspection.resolve({
      ...createInspection(),
      identity: { ...createInspection().identity, mint: 'So11111111111111111111111111111111111111112' },
    });
    await act(async () => {
      await secondAnalysis;
    });

    coachResponse.resolve(createCoach());
    await act(async () => {
      await Promise.resolve();
    });

    expect(getController().report?.mint).toBe('So11111111111111111111111111111111111111112');
    expect(getController().aiError).toBeNull();
  });

  it('aborts active analysis and coach requests on unmount', async () => {
    const pendingInspection = deferred<TokenInspectionResponse>();
    const pendingCoach = deferred<TokenInspectionCoachResponse>();
    let inspectionSignal!: AbortSignal;
    let coachSignal!: AbortSignal;
    const service: TokenInspectionApiService = {
      inspectToken: vi.fn().mockImplementation((_request, signal?: AbortSignal) => {
        inspectionSignal = signal!;
        return pendingInspection.promise;
      }),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockImplementation((_mint, signal?: AbortSignal) => {
        coachSignal = signal!;
        return pendingCoach.promise;
      }),
    };

    const hook = renderHook(service);
    let analysisCall!: Promise<void>;
    act(() => {
      analysisCall = hook.getController().analyzeToken('Mint1111111111111111111111111111111111');
    });
    act(() => {
      hook.unmount();
    });
    expect(inspectionSignal.aborted).toBe(true);
    pendingInspection.resolve(createInspection());
    await analysisCall;

    const completedService: TokenInspectionApiService = {
      inspectToken: vi.fn().mockResolvedValue(createInspection()),
      getProvenance: vi.fn().mockResolvedValue(createProvenance()),
      getCoach: vi.fn().mockImplementation((_mint, signal?: AbortSignal) => {
        coachSignal = signal!;
        return pendingCoach.promise;
      }),
    };
    const coachHook = renderHook(completedService);
    await act(async () => {
      await coachHook.getController().analyzeToken('Mint1111111111111111111111111111111111');
    });
    act(() => {
      void coachHook.getController().explainWithAi();
    });
    act(() => {
      coachHook.unmount();
    });
    expect(coachSignal.aborted).toBe(true);
  });
});
