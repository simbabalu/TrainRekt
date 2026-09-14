import { describe, expect, it } from 'vitest';

import {
  mapCoachTopicToTrainingCta,
  presentChronologyLabel,
  presentClassificationConfidence,
  presentIdentityClassification,
  presentIdentityEvidence,
  presentIdentityLimitation,
} from './tokenAnalysisPresentation';

describe('tokenAnalysisPresentation', () => {
  it('maps deterministic classification values', () => {
    expect(presentIdentityClassification('NO_COLLISION_EVIDENCE').detail).toContain("No matching token identity");
    expect(presentIdentityClassification('COLLISION_DETECTED').detail).toContain('closely matching identity');
    expect(presentIdentityClassification('POSSIBLE_COPYCAT').title).toBe('Possible copycat detected');
    expect(presentIdentityClassification('IDENTITY_CONFLICT').title).toContain('conflicting');
    expect(presentIdentityClassification('INSUFFICIENT_EVIDENCE').detail).toContain('Not enough identity evidence');
  });

  it('handles unknown enum values safely', () => {
    expect(presentIdentityClassification('FUTURE_VALUE').title).toContain('available');
    expect(presentIdentityEvidence('FUTURE_VALUE')).toContain('Additional identity evidence');
    expect(presentIdentityLimitation('FUTURE_VALUE')).toContain('additional limitation');
  });

  it('maps evidence and limitation copy', () => {
    expect(presentIdentityEvidence('SAME_NORMALIZED_NAME')).toContain('same normalized name');
    expect(presentIdentityEvidence('TRUSTED_SOURCE_REFERENCES_COMPETING_MINT')).toContain('competing mint');
    expect(presentIdentityLimitation('COPYING_INTENT_NOT_PROVEN')).toContain('not been proven');
    expect(presentIdentityLimitation('SOCIAL_CONTEXT_NOT_ANALYZED')).toContain('not analyzed');
  });

  it('chronology wording does not claim creation when not proven', () => {
    expect(presentChronologyLabel(false)).toBe('Earliest observed on-chain activity');
    expect(presentChronologyLabel(true)).toContain('proven account creation activity');
  });

  it('confidence wording does not imply safety score', () => {
    const wording = presentClassificationConfidence('POSSIBLE_COPYCAT', 'HIGH');
    expect(wording).toContain('not token safety');
    expect(wording.toLowerCase()).not.toContain('safety score');
  });

  it('maps supported training topics only', () => {
    expect(mapCoachTopicToTrainingCta('token-account-state')).not.toBeNull();
    expect(mapCoachTopicToTrainingCta('unknown-topic')).toBeNull();
    expect(mapCoachTopicToTrainingCta(null)).toBeNull();
  });
});
