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

function renderHook(service: TokenInspectionApiService): { getController: () => Controller } {
  let controller!: Controller;

  function Harness() {
    controller = useTokenAnalysis({ service });
    return null;
  }

  act(() => {
    create(<Harness />);
  });

  return {
    getController: () => controller,
  };
}

describe('useTokenAnalysis', () => {
  it('does not request AI coach during analyzeToken', async () => {
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
    expect(service.getCoach).not.toHaveBeenCalled();
  });

  it('requests AI coach only after explicit action', async () => {
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

    await act(async () => {
      await getController().explainWithAi();
    });

    expect(service.getCoach).toHaveBeenCalledTimes(1);
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

    await act(async () => {
      await getController().explainWithAi();
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

  it('coalesces concurrent explainWithAi calls while first request is pending then resolves ready', async () => {
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

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = getController().explainWithAi();
      secondCall = getController().explainWithAi();
    });

    expect(getController().aiStatus).toBe('loading');
    expect(getController().report?.inspection.identity.mint).toBe('Mint1111111111111111111111111111111111');
    expect(service.getCoach).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCoach(createCoach(true));
      await firstCall;
      await secondCall;
    });

    expect(getController().aiStatus).toBe('ready');
    expect(getController().coach?.summary).toBe('summary');
    expect(getController().report).not.toBeNull();
  });

  it('coalesces concurrent explainWithAi calls while pending and resolves unavailable safely', async () => {
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

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = getController().explainWithAi();
      secondCall = getController().explainWithAi();
    });

    expect(getController().aiStatus).toBe('loading');
    expect(service.getCoach).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCoach(createCoach(false));
      await firstCall;
      await secondCall;
    });

    expect(getController().aiStatus).toBe('unavailable');
    expect(getController().report).not.toBeNull();
  });
});
