import { getWalletLessonExerciseIds } from '@/data/walletLessonCatalog';
import { isWalletTrainingTopic } from '@/types/walletTraining';
import type { TokenAnalysisTrainingCta } from '@/types/tokenAnalysis';

export interface ClassificationPresentation {
  title: string;
  detail: string;
  caution: string;
}

export function presentIdentityClassification(classification: string): ClassificationPresentation {
  switch (classification) {
    case 'NO_COLLISION_EVIDENCE':
      return {
        title: 'No comparison identity found in TrainRekt dataset',
        detail: "No matching token identity was found in TrainRekt's observed dataset. This does not prove token safety.",
        caution: 'This does not prove token safety.',
      };
    case 'COLLISION_DETECTED':
      return {
        title: 'Identity collision detected',
        detail: 'Another observed token uses the same or a closely matching identity.',
        caution: 'This does not prove copying intent or that either token is safe.',
      };
    case 'POSSIBLE_COPYCAT':
      return {
        title: 'Possible copycat detected',
        detail: 'An older on-chain token uses the same identity and trusted identity evidence points to the competing mint.',
        caution: 'This does not prove copying intent or that either token is safe.',
      };
    case 'IDENTITY_CONFLICT':
      return {
        title: 'Identity evidence is conflicting',
        detail: 'Multiple relevant token identities are associated with trusted project evidence.',
        caution: 'This does not prove copying intent or that either token is safe.',
      };
    case 'INSUFFICIENT_EVIDENCE':
      return {
        title: 'Not enough identity evidence',
        detail: 'Not enough identity evidence is available.',
        caution: 'This does not prove token safety.',
      };
    default:
      return {
        title: 'Identity classification available',
        detail: 'Identity classification data was returned with an unrecognized value.',
        caution: 'This does not prove copying intent or token safety.',
      };
  }
}

export function presentClassificationConfidence(classification: string, confidence: string): string {
  const normalized = confidence === 'HIGH' || confidence === 'MEDIUM' || confidence === 'LOW' ? confidence.toLowerCase() : 'unknown';
  const label = presentIdentityClassification(classification).title.toLowerCase();
  return `${capitalize(normalized)} confidence in this ${label}. This is confidence in identity classification, not token safety.`;
}

function capitalize(value: string): string {
  if (!value.length) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function presentIdentityEvidence(value: string): string {
  switch (value) {
    case 'SAME_NORMALIZED_NAME':
      return 'Another observed token uses the same normalized name.';
    case 'SAME_NORMALIZED_SYMBOL':
      return 'Another observed token uses the same symbol.';
    case 'COMPETING_MINT_OBSERVED':
      return 'A competing mint with similar identity was observed in TrainRekt data.';
    case 'SCANNED_MINT_LATER_ON_CHAIN':
      return 'Available on-chain chronology places this mint later.';
    case 'TRUSTED_SOURCE_REFERENCES_COMPETING_MINT':
      return 'Trusted project identity evidence references a competing mint.';
    case 'TRUSTED_SOURCE_DOES_NOT_VERIFY_SCANNED_MINT':
      return 'The trusted source did not verify the scanned mint.';
    case 'TRUSTED_IDENTITY_CONFLICT':
      return 'Trusted identity evidence is conflicting.';
    default:
      return 'Additional identity evidence was reported.';
  }
}

export function presentIdentityLimitation(value: string): string {
  switch (value) {
    case 'COPYING_INTENT_NOT_PROVEN':
      return 'Copying intent has not been proven.';
    case 'GLOBAL_FIRST_TOKEN_NOT_PROVEN':
      return 'TrainRekt has not proven which token was globally first.';
    case 'PROVIDER_HISTORY_MAY_BE_INCOMPLETE':
      return 'Provider history may be incomplete.';
    case 'CHRONOLOGY_COMPARISON_UNAVAILABLE':
      return 'A reliable cross-token chronology comparison was unavailable.';
    case 'OFFICIAL_IDENTITY_NOT_FULLY_VERIFIED':
      return 'Project identity could not be fully verified.';
    case 'SOCIAL_CONTEXT_NOT_ANALYZED':
      return 'Social/trending context was not analyzed.';
    default:
      return 'An additional limitation was reported for this analysis.';
  }
}

export function presentChronologyLabel(accountCreationProven: boolean): string {
  return accountCreationProven ? 'Earliest proven account creation activity' : 'Earliest observed on-chain activity';
}

export function presentChronologyCoverage(value: string): string {
  switch (value) {
    case 'COMPLETE_WITHIN_PROVIDER_RESULT':
      return 'Coverage complete within provider result limits.';
    case 'PARTIAL_PAGE_LIMIT':
      return 'Coverage is partial due to provider page limits.';
    case 'PARTIAL_SIGNATURE_LIMIT':
      return 'Coverage is partial due to signature scan limits.';
    case 'PARTIAL_PROVIDER_FAILURE':
      return 'Coverage is partial due to provider failure during scanning.';
    case 'PARTIAL_TIMEOUT':
      return 'Coverage is partial due to timeout during scanning.';
    case 'UNAVAILABLE':
      return 'Chronology data is unavailable.';
    default:
      return 'Chronology coverage details are unavailable.';
  }
}

export function presentTrustedSourceTrust(value: string): string {
  switch (value) {
    case 'TRUSTED':
      return "A trusted project source was verified against TrainRekt's trust policy.";
    case 'CLAIMED_PROJECT_SOURCE':
      return 'A project-linked source was found, but ownership was not independently verified.';
    case 'DISCOVERED':
      return 'A source associated with token metadata was discovered.';
    default:
      return 'A source was discovered for identity analysis.';
  }
}

export function presentTrustedMintLinkStatus(value: string): string {
  switch (value) {
    case 'REFERENCES_SCANNED_MINT':
      return 'Source references this mint.';
    case 'REFERENCES_COMPETING_MINT':
      return 'Source references another relevant mint.';
    case 'REFERENCES_MULTIPLE_RELEVANT_MINTS':
      return 'Source references multiple relevant mints.';
    case 'NO_RELEVANT_MINT_REFERENCE':
      return 'Source does not reference a relevant mint.';
    case 'FETCH_UNAVAILABLE':
      return 'Source content could not be fetched safely.';
    case 'UNVERIFIED':
      return 'Source mint reference is unverified.';
    default:
      return 'Source mint reference details are unavailable.';
  }
}

export function mapCoachTopicToTrainingCta(recommendedTrainingTopicId: string | null): TokenAnalysisTrainingCta | null {
  if (!recommendedTrainingTopicId || !isWalletTrainingTopic(recommendedTrainingTopicId)) {
    return null;
  }

  const exerciseIds = getWalletLessonExerciseIds(recommendedTrainingTopicId);
  const firstExerciseId = exerciseIds[0];
  if (!firstExerciseId) {
    return null;
  }

  return {
    topic: recommendedTrainingTopicId,
    exerciseId: firstExerciseId,
  };
}
