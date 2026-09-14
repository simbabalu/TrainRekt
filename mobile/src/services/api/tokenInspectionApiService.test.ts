import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpTokenInspectionApiService } from './tokenInspectionApiService';
import { TokenInspectionApiError } from '@/types/tokenAnalysis';

describe('HttpTokenInspectionApiService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('calls inspection endpoint with typed request', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      identity: { mint: 'mint', name: 'Token', symbol: 'TOK' },
      authorities: { mintAuthorityRevoked: true, freezeAuthorityRevoked: true, mintAuthority: null, freezeAuthority: null },
      program: { programId: 'pid', programType: 'spl-token' },
      age: { ageSeconds: 10, isReliable: true, unavailableReason: null },
      holderConcentration: {
        topHolderPercentage: 10,
        top5HoldersPercentage: 20,
        top10HoldersPercentage: 30,
        semanticsNote: 'note',
        unclassifiedTokenAccountConcentration: null,
      },
      largestTokenAccounts: [],
      reviewSignals: [],
      inspectedAtUtc: new Date().toISOString(),
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const service = new HttpTokenInspectionApiService({ baseUrl: 'https://api.trainrekt.test' });
    const result = await service.inspectToken({ mint: 'mint' });

    expect(result.identity.mint).toBe('mint');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.trainrekt.test/api/token-inspections',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('calls provenance endpoint with mint path', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      result: 'COLLISION_OBSERVED',
      confidence: 'MEDIUM',
      scannedIdentity: { mint: 'mint', rawName: null, normalizedName: null, rawSymbol: null, normalizedSymbol: null, observedAtUtc: new Date().toISOString() },
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
      identityClassification: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const service = new HttpTokenInspectionApiService({ baseUrl: 'https://api.trainrekt.test' });
    await service.getProvenance('mint 1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.trainrekt.test/api/token-inspections/mint%201/provenance',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('calls coach endpoint and maps response', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      available: true,
      status: 'available',
      coach: {
        summary: 'summary',
        riskExplanations: ['risk'],
        whatToCheckNext: ['check'],
        uncertainty: ['uncertain'],
        recommendedTrainingTopicId: null,
        coachVersion: 2,
        generatedAtUtc: new Date().toISOString(),
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const service = new HttpTokenInspectionApiService({ baseUrl: 'https://api.trainrekt.test' });
    const result = await service.getCoach('mint');

    expect(result.available).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.trainrekt.test/api/token-inspections/mint/coach',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps backend problem details and avoids leaking raw body', async () => {
    fetchMock.mockResolvedValue(new Response('internal stack trace details', {
      status: 503,
      headers: { 'content-type': 'text/plain' },
    }));

    const service = new HttpTokenInspectionApiService({ baseUrl: 'https://api.trainrekt.test' });

    await expect(service.inspectToken({ mint: 'mint' })).rejects.toMatchObject({
      name: 'TokenInspectionApiError',
      reason: 'provider-unavailable',
      message: 'Token analysis request failed. Please try again.',
    } satisfies Partial<TokenInspectionApiError>);
  });

  it('throws config error when base URL is missing', async () => {
    const service = new HttpTokenInspectionApiService({ baseUrl: null });

    await expect(service.inspectToken({ mint: 'mint' })).rejects.toMatchObject({
      reason: 'backend-unavailable',
    } satisfies Partial<TokenInspectionApiError>);
  });

  it('does not send provider API secrets from mobile', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      available: false,
      status: 'unavailable',
      coach: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const service = new HttpTokenInspectionApiService({ baseUrl: 'https://api.trainrekt.test' });
    await service.getCoach('mint');

    const call = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = call.headers as Record<string, string>;
    expect(headers['authorization']).toBeUndefined();
    expect(headers['x-helius-api-key']).toBeUndefined();
    expect(headers['x-gemini-api-key']).toBeUndefined();
  });
});
