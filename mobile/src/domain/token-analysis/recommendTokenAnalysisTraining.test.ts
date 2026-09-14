import { describe, expect, it } from 'vitest';

import { recommendTokenAnalysisTraining } from './recommendTokenAnalysisTraining';
import type { TokenAnalysisReport } from '@/types/tokenAnalysis';

function createReport(overrides: Partial<TokenAnalysisReport['inspection']> = {}): TokenAnalysisReport {
  return {
    mint: 'Mint1111111111111111111111111111111111',
    inspection: {
      identity: { mint: 'Mint1111111111111111111111111111111111', name: 'Token', symbol: 'TOK' },
      authorities: { mintAuthorityRevoked: true, freezeAuthorityRevoked: true, mintAuthority: null, freezeAuthority: null },
      program: { programId: 'Tokenkeg', programType: 'spl-token' },
      age: { ageSeconds: 10, isReliable: true, unavailableReason: null },
      holderConcentration: {
        topHolderPercentage: 32,
        top5HoldersPercentage: 60,
        top10HoldersPercentage: 70,
        semanticsNote: 'context',
        unclassifiedTokenAccountConcentration: null,
      },
      largestTokenAccounts: [],
      reviewSignals: [],
      inspectedAtUtc: new Date().toISOString(),
      ...overrides,
    },
    provenance: null,
    provenanceWarning: null,
  };
}

describe('recommendTokenAnalysisTraining', () => {
  it('recommends token-2022 lesson when token-2022 finding exists', () => {
    const recommendation = recommendTokenAnalysisTraining(
      createReport({ program: { programId: 'TokenzQd', programType: 'token-2022' } }),
    );

    expect(recommendation?.topic).toBe('token-2022');
    expect(recommendation?.exerciseId).toBeTruthy();
  });

  it('recommends token-account-state lesson from authority findings', () => {
    const recommendation = recommendTokenAnalysisTraining(
      createReport({
        authorities: {
          mintAuthorityRevoked: false,
          freezeAuthorityRevoked: true,
          mintAuthority: 'Authority1111111111111111111111111111111111',
          freezeAuthority: null,
        },
      }),
    );

    expect(recommendation?.topic).toBe('token-account-state');
    expect(recommendation?.exerciseId).toBeTruthy();
  });

  it('derives recommendations only from findings present in the analyzed token', () => {
    const recommendation = recommendTokenAnalysisTraining(
      createReport({
        program: { programId: 'Tokenkeg', programType: 'spl-token' },
        authorities: {
          mintAuthorityRevoked: true,
          freezeAuthorityRevoked: true,
          mintAuthority: null,
          freezeAuthority: null,
        },
        holderConcentration: {
          topHolderPercentage: null,
          top5HoldersPercentage: null,
          top10HoldersPercentage: null,
          semanticsNote: 'Unavailable',
          unclassifiedTokenAccountConcentration: null,
        },
        largestTokenAccounts: [],
      }),
    );

    expect(recommendation).toBeNull();
  });
});
