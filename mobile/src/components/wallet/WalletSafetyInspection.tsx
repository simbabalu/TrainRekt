import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { categorizeWalletInspectionAccounts } from '@/domain/wallet/categorizeWalletInspectionAccounts';
import { recommendWalletTraining } from '@/domain/wallet/recommendWalletTraining';
import { getWalletLessonStatus } from '@/domain/wallet/getWalletLessonStatus';
import { getNextWalletTrainingRecommendation, sortWalletTrainingRecommendations } from '@/domain/wallet/sortWalletTrainingRecommendations';
import { summarizeWalletInspection } from '@/domain/wallet/summarizeWalletInspection';
import type { WalletSafetyInspection as WalletSafetyInspectionModel } from '@/types/walletInspection';
import type { WalletLessonProgress } from '@/types/progress';
import type { WalletInspectionStatus, WalletInspectionViewMode } from '@/hooks/useWalletSafetyInspection';
import { TokenAccountInspectionRow } from './TokenAccountInspectionRow';
import { WalletInspectionSummary } from './WalletInspectionSummary';
import { WalletInspectionEducationDetails } from './WalletInspectionEducationDetails';
import { WalletTrainingRecommendationCard } from './WalletTrainingRecommendationCard';

interface WalletSafetyInspectionProps {
  scrollRef?: React.RefObject<ScrollView | null>;
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

function AccountListSection({
  title,
  accounts,
  mintByAddress,
  emptyMessage,
}: {
  title: string;
  accounts: WalletSafetyInspectionModel['tokenAccounts'];
  mintByAddress: ReadonlyMap<string, WalletSafetyInspectionModel['mintInspections'][number]>;
  emptyMessage?: string;
}) {
  return (
    <View style={styles.findingsSection}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      {emptyMessage && accounts.length === 0 && <Text style={styles.info}>{emptyMessage}</Text>}
      {accounts.length > 0 && (
        <View style={styles.list}>
          {accounts.map((account) => (
            <TokenAccountInspectionRow
              key={account.tokenAccountAddress}
              account={account}
              mintInspection={mintByAddress.get(account.mintAddress) ?? null}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function DisclosureControls({
  viewMode,
  informationalAccountCount,
  inspectedAccountCount,
  status,
  onViewModeChange,
}: {
  viewMode: WalletInspectionViewMode;
  informationalAccountCount: number;
  inspectedAccountCount: number;
  status: WalletInspectionStatus;
  onViewModeChange: (mode: WalletInspectionViewMode) => void;
}) {
  return (
    <View style={styles.controlsBox}>
      <Text style={styles.sectionTitle}>ACCOUNT DISCLOSURE CONTROLS</Text>
      {viewMode !== 'all' && informationalAccountCount > 0 && (
        <PrimaryButton
          onPress={() => onViewModeChange(viewMode === 'informational' ? 'collapsed' : 'informational')}
          disabled={status === 'loading'}
          variant="secondary"
        >
          {viewMode === 'informational' ? 'HIDE INFORMATIONAL' : `SHOW INFORMATIONAL (${informationalAccountCount})`}
        </PrimaryButton>
      )}

      {viewMode === 'all' ? (
        <PrimaryButton
          onPress={() => onViewModeChange('collapsed')}
          disabled={status === 'loading'}
          variant="secondary"
        >
          HIDE ALL ACCOUNTS
        </PrimaryButton>
      ) : (
        <PrimaryButton
          onPress={() => onViewModeChange('all')}
          disabled={status === 'loading'}
          variant="secondary"
        >
          {`SHOW ALL ${inspectedAccountCount} ACCOUNTS`}
        </PrimaryButton>
      )}
    </View>
  );
}

export function WalletSafetyInspection({ scrollRef, connected, status, viewMode, inspection, error, onViewModeChange, onRefresh, walletLessonProgress = {} }: WalletSafetyInspectionProps) {
  const router = useRouter();
  const cardLayoutYRef = useRef<number | null>(null);
  const containerLayoutYRef = useRef<number | null>(null);
  const sectionLayoutYRefs = useRef<Partial<Record<Extract<WalletInspectionViewMode, 'review' | 'informational' | 'all'>, number>>>({});
  const pendingScrollModeRef = useRef<Extract<WalletInspectionViewMode, 'review' | 'informational' | 'all'> | null>(null);
  const tokenAccounts = inspection?.tokenAccounts ?? [];
  const mintInspections = inspection?.mintInspections ?? [];
  const mintByAddress = new Map(mintInspections.map((mintInspection) => [mintInspection.mintAddress, mintInspection]));
  const summary = summarizeWalletInspection(tokenAccounts);
  const categorized = categorizeWalletInspectionAccounts(tokenAccounts, mintInspections);
  const categorySummary = categorized.summary;
  const recommendations = recommendWalletTraining(tokenAccounts, mintInspections);
  const recommendationsWithStatus = recommendations.map((recommendation) => ({
    recommendation,
    status: getWalletLessonStatus({ exerciseId: recommendation.recommendedExerciseIds[0], walletLessonProgress }),
  }));
  const learningPath = sortWalletTrainingRecommendations(recommendationsWithStatus);
  const nextRecommendation = getNextWalletTrainingRecommendation(learningPath);
  const remainingRecommendations = nextRecommendation
    ? learningPath.filter(({ recommendation }) => recommendation.topic !== nextRecommendation.recommendation.topic)
    : learningPath;

  function handleStartLesson(selectedRecommendation: typeof recommendations[number]) {
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
  }

  const canRenderInspection = Boolean(inspection);

  function scrollToExpandedSection(mode: Extract<WalletInspectionViewMode, 'review' | 'informational' | 'all'>) {
    const cardLayoutY = cardLayoutYRef.current;
    const containerLayoutY = containerLayoutYRef.current;
    const sectionLayoutY = sectionLayoutYRefs.current[mode];
    if (cardLayoutY === null || containerLayoutY === null || sectionLayoutY === undefined) return;

    pendingScrollModeRef.current = null;
    scrollRef?.current?.scrollTo({ y: Math.max(cardLayoutY + containerLayoutY + sectionLayoutY - Spacing.md, 0), animated: true });
  }

  function handleLayout(mode: Extract<WalletInspectionViewMode, 'review' | 'informational' | 'all'>, event: LayoutChangeEvent) {
    sectionLayoutYRefs.current[mode] = event.nativeEvent.layout.y;
    if (pendingScrollModeRef.current === mode) scrollToExpandedSection(mode);
  }

  function handleCardLayout(event: LayoutChangeEvent) {
    cardLayoutYRef.current = event.nativeEvent.layout.y;
    if (pendingScrollModeRef.current) scrollToExpandedSection(pendingScrollModeRef.current);
  }

  function handleContainerLayout(event: LayoutChangeEvent) {
    containerLayoutYRef.current = event.nativeEvent.layout.y;
    if (pendingScrollModeRef.current) scrollToExpandedSection(pendingScrollModeRef.current);
  }

  function handleViewModeChange(nextMode: WalletInspectionViewMode) {
    if (nextMode === 'review' || nextMode === 'informational' || nextMode === 'all') {
      pendingScrollModeRef.current = nextMode;
    } else {
      pendingScrollModeRef.current = null;
    }
    onViewModeChange(nextMode);
  }

  return (
    <View onLayout={handleCardLayout}>
      <SectionCard>
        <View
          style={styles.container}
          onLayout={handleContainerLayout}
        >
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

                {viewMode === 'review' && (
                  <View onLayout={(event) => handleLayout('review', event)}>
                    <Text style={styles.sectionTitle}>{`NEEDS REVIEW (${categorySummary.reviewAccountCount})`}</Text>
                    <PrimaryButton
                      onPress={() => handleViewModeChange('collapsed')}
                      disabled={status === 'loading'}
                      variant="secondary"
                    >
                      HIDE NEEDS REVIEW
                    </PrimaryButton>
                    <AccountListSection
                      title=""
                      accounts={categorized.reviewAccounts}
                      mintByAddress={mintByAddress}
                      emptyMessage="No review signals detected in the inspected token accounts."
                    />
                  </View>
                )}

                {viewMode !== 'review' && (
                  <>
                    <Text style={styles.sectionTitle}>{`NEEDS REVIEW (${categorySummary.reviewAccountCount})`}</Text>
                    <PrimaryButton
                      onPress={() => handleViewModeChange('review')}
                      disabled={status === 'loading'}
                      variant="secondary"
                    >
                      SHOW NEEDS REVIEW
                    </PrimaryButton>
                  </>
                )}

                <DisclosureControls
                  viewMode={viewMode}
                  informationalAccountCount={categorySummary.informationalAccountCount}
                  inspectedAccountCount={categorySummary.inspectedAccountCount}
                  status={status}
                  onViewModeChange={handleViewModeChange}
                />

                {viewMode === 'informational' && (
                  <View onLayout={(event) => handleLayout('informational', event)}>
                    <Text style={styles.info}>Token-2022 is informational. Token-2022 itself is not a warning.</Text>
                    <AccountListSection
                      title={`INFORMATIONAL (${categorySummary.informationalAccountCount})`}
                      accounts={categorized.informationalAccounts}
                      mintByAddress={mintByAddress}
                    />
                  </View>
                )}

                {viewMode === 'all' && (
                  <View onLayout={(event) => handleLayout('all', event)}>
                    <AccountListSection
                      title={`ALL ACCOUNTS (${categorySummary.inspectedAccountCount})`}
                      accounts={tokenAccounts}
                      mintByAddress={mintByAddress}
                    />
                  </View>
                )}

                <View style={styles.lessonBox}>
                  <Text style={styles.educationTitle}>LEARN FROM YOUR WALLET</Text>
                  <Text style={styles.educationText}>Training topics based on public signals observed in this wallet.</Text>
                  {recommendations.length === 0 ? (
                    <Text style={styles.info}>No review signals found. You can still practice general wallet-safety lessons.</Text>
                  ) : nextRecommendation ? (
                    <>
                      <Text style={styles.nextLessonTitle}>NEXT RECOMMENDED LESSON</Text>
                      <WalletTrainingRecommendationCard
                        recommendation={nextRecommendation.recommendation}
                        status={nextRecommendation.status}
                        featured
                        onStartLesson={handleStartLesson}
                      />
                    </>
                  ) : <Text style={styles.completedLesson}>WALLET LESSONS COMPLETE{`\n`}You&apos;ve completed the lessons currently recommended from this wallet inspection.</Text>}
                  {remainingRecommendations.length > 0 && (
                    <View style={styles.lessonList}>
                      {remainingRecommendations.map(({ recommendation, status: lessonStatus }) => (
                        <WalletTrainingRecommendationCard
                          key={recommendation.topic}
                          recommendation={recommendation}
                          status={lessonStatus}
                          onStartLesson={handleStartLesson}
                        />
                      ))}
                    </View>
                  )}
                </View>

                <WalletInspectionEducationDetails summary={summary} />

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
    </View>
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
    lineHeight: TypographyLineHeight.small,
  },
  info: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
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
    lineHeight: TypographyLineHeight.small,
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
    lineHeight: TypographyLineHeight.small,
  },
  nextLessonTitle: {
    color: Colors.accent,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  completedLesson: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
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
