import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { categorizeWalletInspectionAccounts } from '@/domain/wallet/categorizeWalletInspectionAccounts';
import { recommendWalletTraining } from '@/domain/wallet/recommendWalletTraining';
import { getWalletLessonStatus } from '@/domain/wallet/getWalletLessonStatus';
import { summarizeWalletInspection } from '@/domain/wallet/summarizeWalletInspection';
import type { WalletSafetyInspection as WalletSafetyInspectionModel } from '@/types/walletInspection';
import type { WalletLessonProgress } from '@/types/progress';
import type { WalletInspectionStatus, WalletInspectionViewMode } from '@/hooks/useWalletSafetyInspection';
import { TokenAccountInspectionRow } from './TokenAccountInspectionRow';
import { WalletInspectionSummary } from './WalletInspectionSummary';
import { WalletInspectionEducationDetails } from './WalletInspectionEducationDetails';
import { WalletTrainingRecommendationCard } from './WalletTrainingRecommendationCard';

interface WalletSafetyInspectionProps {
  connected: boolean;
  status: WalletInspectionStatus;
  viewMode: WalletInspectionViewMode;
  inspection: WalletSafetyInspectionModel | null;
  error: string | null;
  onViewModeChange: (mode: WalletInspectionViewMode) => void;
  onRefresh: () => void;
  walletLessonProgress?: Readonly<WalletLessonProgress>;
}

function StatusText({ status, error, hasInspection }: { status: WalletInspectionStatus; error: string | null; hasInspection: boolean }) {
  if (status === 'loading' && hasInspection) return <Text style={styles.info}>Refreshing inspection results...</Text>;
  if (status === 'loading') return <Text style={styles.info}>Reviewing token-account signals...</Text>;
  if (status === 'unavailable') return <Text style={styles.error}>{error ?? 'Wallet inspection is unavailable right now.'}</Text>;
  if (status === 'partial') return <Text style={styles.info}>Inspection completed with partial results. Some token-account queries could not be completed.</Text>;
  return null;
}

export function WalletSafetyInspection({ connected, status, viewMode, inspection, error, onViewModeChange, onRefresh, walletLessonProgress = {} }: WalletSafetyInspectionProps) {
  const router = useRouter();
  const tokenAccounts = inspection?.tokenAccounts ?? [];
  const summary = summarizeWalletInspection(tokenAccounts);
  const categorized = categorizeWalletInspectionAccounts(tokenAccounts);
  const categorySummary = categorized.summary;
  const recommendations = recommendWalletTraining(tokenAccounts);
  const recommendationsWithStatus = recommendations.map((recommendation) => ({
    recommendation,
    status: getWalletLessonStatus({ exerciseId: recommendation.recommendedExerciseIds[0], walletLessonProgress }),
  }));

  const visibleAccounts = (() => {
    if (viewMode === 'all') return tokenAccounts;
    if (viewMode === 'informational') return categorized.informationalAccounts;
    return categorized.reviewAccounts;
  })();

  const listTitle = (() => {
    if (viewMode === 'all') return `SHOWING ALL ACCOUNTS (${categorySummary.inspectedAccountCount})`;
    if (viewMode === 'informational') return `INFORMATIONAL (${categorySummary.informationalAccountCount})`;
    return `NEEDS REVIEW (${categorySummary.reviewAccountCount})`;
  })();

  const canRenderInspection = Boolean(inspection);

  return (
    <SectionCard>
      <View style={styles.container}>
        <Text style={styles.title}>WALLET SAFETY INSPECTION</Text>
        <Text style={styles.subtitle}>Review public wallet signals that may deserve attention.</Text>

        {!connected && (
          <Text style={styles.info}>Connect a wallet to inspect public token-account signals.</Text>
        )}

        {connected && (
          <>
            <StatusText status={status} error={error} hasInspection={canRenderInspection} />

            {canRenderInspection && (
              <>
                <WalletInspectionSummary summary={summary} categorySummary={categorySummary} />

                {inspection && inspection.warnings.length > 0 && (
                  <View style={styles.warningBox}>
                    {inspection.warnings.map((warning) => (
                      <Text key={warning} style={styles.warningText}>{warning}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.findingsSection}>
                  <Text style={styles.sectionTitle}>{listTitle}</Text>
                  {viewMode === 'review' && categorized.reviewAccounts.length === 0 && (
                    <Text style={styles.info}>No review signals detected in the inspected token accounts.</Text>
                  )}

                  {visibleAccounts.length > 0 && (
                    <View style={styles.list}>
                      {visibleAccounts.map((account) => (
                        <TokenAccountInspectionRow key={account.tokenAccountAddress} account={account} />
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.lessonBox}>
                  <Text style={styles.educationTitle}>LEARN FROM YOUR WALLET</Text>
                  <Text style={styles.educationText}>Training topics based on public signals observed in this wallet.</Text>
                  {recommendations.length === 0 ? (
                    <Text style={styles.info}>No review signals found. You can still practice general wallet-safety lessons.</Text>
                  ) : (
                    <View style={styles.lessonList}>
                      {recommendationsWithStatus.map(({ recommendation, status: lessonStatus }) => (
                        <WalletTrainingRecommendationCard
                          key={recommendation.topic}
                          recommendation={recommendation}
                          status={lessonStatus}
                          onStartLesson={(selectedRecommendation) => {
                            const firstExerciseId = selectedRecommendation.recommendedExerciseIds[0];
                            if (!firstExerciseId) return;
                            router.push({
                              pathname: '/train',
                              params: {
                                mode: 'practice',
                                source: 'wallet',
                                topic: selectedRecommendation.topic,
                                exerciseId: firstExerciseId,
                              },
                            });
                          }}
                        />
                      ))}
                    </View>
                  )}
                </View>

                <WalletInspectionEducationDetails summary={summary} />

                <View style={styles.controlsBox}>
                  {categorySummary.informationalAccountCount > 0 && (
                    <>
                      <Text style={styles.info}>Token-2022 is informational. Token-2022 itself is not a warning.</Text>
                      <PrimaryButton
                        onPress={() => {
                          onViewModeChange(viewMode === 'informational' ? 'review' : 'informational');
                        }}
                        disabled={status === 'loading'}
                        variant="secondary"
                      >
                        {viewMode === 'informational'
                          ? 'HIDE INFORMATIONAL'
                          : `SHOW INFORMATIONAL (${categorySummary.informationalAccountCount})`}
                      </PrimaryButton>
                    </>
                  )}

                  {viewMode === 'all' ? (
                    <>
                      <Text style={styles.sectionTitle}>SHOWING ALL ACCOUNTS</Text>
                      <PrimaryButton
                        onPress={() => {
                          onViewModeChange('review');
                        }}
                        disabled={status === 'loading'}
                        variant="secondary"
                      >
                        HIDE ALL
                      </PrimaryButton>
                    </>
                  ) : (
                    <PrimaryButton
                      onPress={() => {
                        onViewModeChange('all');
                      }}
                      disabled={status === 'loading'}
                      variant="secondary"
                    >
                      {`SHOW ALL ${categorySummary.inspectedAccountCount} ACCOUNTS`}
                    </PrimaryButton>
                  )}
                </View>

              </>
            )}

            {(status === 'idle' || (status === 'unavailable' && !canRenderInspection)) && (
              <Text style={styles.info}>Run inspection to load the latest public wallet-account signals.</Text>
            )}

            {!canRenderInspection && (
              <PrimaryButton onPress={onRefresh} disabled={status === 'loading'} variant="secondary">
                {status === 'loading' ? 'INSPECTING...' : status === 'unavailable' ? 'RETRY INSPECTION' : 'REFRESH INSPECTION'}
              </PrimaryButton>
            )}
          </>
        )}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: 20,
  },
  info: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: 20,
  },
  error: {
    color: Colors.negative,
    fontSize: Typography.small,
    fontWeight: '700',
  },
  warningBox: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  warningText: {
    color: Colors.warning,
    fontSize: Typography.small,
    lineHeight: 18,
  },
  educationTitle: {
    color: Colors.accent,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  educationText: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: 20,
  },
  findingsSection: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  controlsBox: {
    gap: Spacing.sm,
  },
  lessonBox: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  lessonList: {
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
  },
});
