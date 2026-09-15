import { useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { AnalysisFactRow } from '@/components/token-analysis/AnalysisFactRow';
import { AnalysisSectionHeader } from '@/components/token-analysis/AnalysisSectionHeader';
import { AnalysisStatusBadge } from '@/components/token-analysis/AnalysisStatusBadge';
import { ProvenanceSourceRow } from '@/components/token-analysis/ProvenanceSourceRow';
import { TokenAnalysisSummaryCard } from '@/components/token-analysis/TokenAnalysisSummaryCard';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import {
  getConsistentIssuanceContext,
  presentMintAuthorityContextLine,
  presentTokenomicsContextDescription,
} from '@/domain/token-analysis/tokenAnalysisAuthorityContext';
import { recommendTokenAnalysisTraining } from '@/domain/token-analysis/recommendTokenAnalysisTraining';
import {
  buildTrustedIdentityConclusion,
  buildProvenanceSourcePresentation,
  buildReviewSignalPresentation,
} from '@/domain/token-analysis/tokenAnalysisFullAnalysisPresentation';
import {
  mapCoachTopicToTrainingCta,
  presentClassificationConfidence,
  presentIdentityClassification,
  presentIdentityEvidence,
} from '@/domain/token-analysis/tokenAnalysisPresentation';
import type { TokenAnalysisAiStatus, TokenAnalysisReport, TokenInspectionCoachResponse } from '@/types/tokenAnalysis';
import type { WalletTrainingTopic } from '@/types/walletTraining';

interface TokenAnalysisReportCardProps {
  report: TokenAnalysisReport;
  deterministicError: string | null;
  aiStatus: TokenAnalysisAiStatus;
  aiError: string | null;
  coach: TokenInspectionCoachResponse['coach'];
  onExplainWithAi: () => void;
  onStartTraining: (topic: WalletTrainingTopic, exerciseId: string) => void;
  onRequestScrollTo: (y: number) => void;
}

function pct(value: number | null): string {
  if (value == null) return 'Unavailable';
  return `${value.toFixed(2)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

function toneForAuthority(revoked: boolean): 'positive' | 'warning' {
  return revoked ? 'positive' : 'warning';
}

function claimLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}

export function TokenAnalysisReportCard({
  report,
  deterministicError,
  aiStatus,
  aiError,
  coach,
  onExplainWithAi,
  onStartTraining,
  onRequestScrollTo,
}: TokenAnalysisReportCardProps) {
  const reportKey = `${report.mint}:${report.inspection.inspectedAtUtc}`;
  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(null);
  const [expandedSourceEvidenceKey, setExpandedSourceEvidenceKey] = useState<string | null>(null);
  const showFullAnalysis = expandedReportKey === reportKey;
  const showSourceEvidence = expandedSourceEvidenceKey === reportKey;
  const summaryTopYRef = useRef(0);
  const pendingOpenScrollRef = useRef(false);
  const classification = report.provenance?.identityClassification;
  const coachTraining = mapCoachTopicToTrainingCta(coach?.recommendedTrainingTopicId ?? null);
  const summaryTraining = recommendTokenAnalysisTraining(report);
  const issuanceContext = getConsistentIssuanceContext(report);
  const mintAuthorityContext = presentMintAuthorityContextLine(report);
  const tokenomicsDescription = presentTokenomicsContextDescription(report);
  const reviewItems = buildReviewSignalPresentation(report);
  const provenanceItems = buildProvenanceSourcePresentation(report);
  const trustedIdentityConclusion = buildTrustedIdentityConclusion(report);
  const hasConflictingMintEvidence = trustedIdentityConclusion.conflictingMintReferences > 0;
  const protocolAccounts = report.inspection.largestTokenAccounts.slice(0, 5).filter((account) => account.classification.protocol);
  const unclassifiedAccounts = report.inspection.largestTokenAccounts.slice(0, 5).filter((account) => !account.classification.protocol);

  function handleSummaryLayout(event: LayoutChangeEvent) {
    summaryTopYRef.current = event.nativeEvent.layout.y;
  }

  function handleFullAnalysisLayout(event: LayoutChangeEvent) {
    if (!pendingOpenScrollRef.current) return;
    pendingOpenScrollRef.current = false;
    const y = event.nativeEvent.layout.y;
    requestAnimationFrame(() => {
      onRequestScrollTo(y);
    });
  }

  function handleToggleFullAnalysis() {
    if (showFullAnalysis) {
      setExpandedReportKey(null);
      requestAnimationFrame(() => {
        onRequestScrollTo(summaryTopYRef.current);
      });
      return;
    }

    pendingOpenScrollRef.current = true;
    setExpandedReportKey(reportKey);
  }

  function handleToggleSourceEvidence() {
    setExpandedSourceEvidenceKey((current) => (current === reportKey ? null : reportKey));
  }

  function conclusionTone(): 'positive' | 'review' | 'informational' | 'neutral' {
    if (trustedIdentityConclusion.state === 'confirmed') return 'positive';
    if (trustedIdentityConclusion.state === 'conflicting') return 'review';
    if (trustedIdentityConclusion.state === 'partially-supported') return 'informational';
    return 'neutral';
  }

  function handleUnderstandSignals() {
    if (summaryTraining) {
      onStartTraining(summaryTraining.topic, summaryTraining.exerciseId);
      return;
    }

    handleToggleFullAnalysis();
  }

  return (
    <View style={styles.container}>
      <View onLayout={handleSummaryLayout}>
        <TokenAnalysisSummaryCard
          report={report}
          isFullAnalysisVisible={showFullAnalysis}
          onToggleFullAnalysis={handleToggleFullAnalysis}
          onUnderstandSignals={handleUnderstandSignals}
        />
      </View>
      <SectionCard>
        <AnalysisSectionHeader icon="coach" title="AI SAFETY COACH" />
        <Text style={styles.muted}>AI explains verified TrainRekt findings. It does not determine token safety.</Text>
        {aiStatus === 'idle' && (
          <PrimaryButton onPress={onExplainWithAi} variant="secondary">EXPLAIN WITH AI</PrimaryButton>
        )}
        {aiStatus === 'loading' && (
          <PrimaryButton onPress={() => undefined} disabled variant="secondary">LOADING AI EXPLANATION...</PrimaryButton>
        )}
        {aiStatus === 'unavailable' && (
          <>
            <Text style={styles.error}>{aiError ?? 'AI explanation is currently unavailable.'}</Text>
            <PrimaryButton onPress={onExplainWithAi} variant="secondary">TRY AGAIN</PrimaryButton>
          </>
        )}
        {aiStatus === 'ready' && coach && (
          <View style={styles.rowBlock}>
            <AnalysisFactRow label="SUMMARY" value={coach.summary} />
            <Text style={styles.sectionCaption}>WHY THIS MATTERS</Text>
            {coach.riskExplanations.map((item, index) => <Text key={`coach-risk:${item}:${index}`} style={styles.body}>- {item}</Text>)}
            <Text style={styles.sectionCaption}>WHAT TO CHECK NEXT</Text>
            {coach.whatToCheckNext.map((item, index) => <Text key={`coach-next:${item}:${index}`} style={styles.body}>- {item}</Text>)}
            <Text style={styles.sectionCaption}>UNCERTAINTY</Text>
            {coach.uncertainty.map((item, index) => <Text key={`coach-uncertainty:${item}:${index}`} style={styles.body}>- {item}</Text>)}
            {coachTraining ? (
              <>
                <PrimaryButton onPress={() => onStartTraining(coachTraining.topic, coachTraining.exerciseId)}>
                  PRACTICE THIS SKILL
                </PrimaryButton>
              </>
            ) : null}
          </View>
        )}
      </SectionCard>
      {showFullAnalysis ? <View onLayout={handleFullAnalysisLayout}>
        {deterministicError ? (
          <SectionCard>
            <Text style={styles.error}>{deterministicError}</Text>
          </SectionCard>
        ) : null}

        <SectionCard>
          <AnalysisSectionHeader icon="identity" title="TOKEN IDENTITY" />
          <AnalysisFactRow label="NAME" value={report.inspection.identity.name} selectable />
          <AnalysisFactRow label="SYMBOL" value={report.inspection.identity.symbol} />
          <AnalysisFactRow label="MINT" value={report.inspection.identity.mint} monospace selectable />
          <AnalysisFactRow label="PROGRAM" value={report.inspection.program.programType} />
          <AnalysisFactRow label="PROGRAM ID" value={report.inspection.program.programId} monospace selectable />
          <AnalysisFactRow label="INSPECTED" value={formatDate(report.inspection.inspectedAtUtc)} />
        </SectionCard>

        <SectionCard>
          <AnalysisSectionHeader icon="classification" title="IDENTITY CLASSIFICATION" />
          {classification ? (
            <>
              <View style={styles.badgeRow}>
                <AnalysisStatusBadge
                  label={presentIdentityClassification(classification.classification).title.toUpperCase()}
                  tone="review"
                />
              </View>
              <Text style={styles.body}>{presentIdentityClassification(classification.classification).detail}</Text>
              <AnalysisFactRow label="CONFIDENCE" value={classification.confidence} valueTone="warning" />
              <Text style={styles.muted}>{presentClassificationConfidence(classification.classification, classification.confidence)}</Text>
              <Text style={styles.warning}>{presentIdentityClassification(classification.classification).caution}</Text>
            </>
          ) : (
            <Text style={styles.muted}>Identity classification is currently unavailable.</Text>
          )}
        </SectionCard>

        <SectionCard>
          <AnalysisSectionHeader icon="review" title="REVIEW SIGNALS" />
          {reviewItems.length === 0 ? <Text style={styles.muted}>No review signals returned.</Text> : reviewItems.map((item) => (
            <View key={item.id} style={styles.rowBlock}>
              <View style={styles.badgeRow}>
                <AnalysisStatusBadge label={item.label} tone={item.tone} />
                <AnalysisStatusBadge label={item.value} tone={item.tone} />
              </View>
              {item.details.map((detail, index) => <Text key={`${item.id}:detail:${index}`} style={styles.body}>{detail}</Text>)}
            </View>
          ))}
        </SectionCard>

        <SectionCard>
          <AnalysisSectionHeader icon="authorities" title="AUTHORITIES" />
          <AnalysisFactRow
            label="MINT AUTHORITY"
            value={report.inspection.authorities.mintAuthorityRevoked ? 'Revoked' : 'Active'}
            valueTone={toneForAuthority(report.inspection.authorities.mintAuthorityRevoked)}
            description={mintAuthorityContext}
          />
          <AnalysisFactRow
            label="FREEZE AUTHORITY"
            value={report.inspection.authorities.freezeAuthorityRevoked ? 'Revoked' : 'Active'}
            valueTone={toneForAuthority(report.inspection.authorities.freezeAuthorityRevoked)}
          />
          {tokenomicsDescription ? (
            <View style={styles.rowBlock}>
              <AnalysisSectionHeader icon="concentration" title="TOKENOMICS CONTEXT" />
              <AnalysisFactRow label="MODEL" value="Inflationary supply model" valueTone="accent" description={tokenomicsDescription} />
              {issuanceContext ? (
                <View style={styles.badgeRow}>
                  <AnalysisStatusBadge label={claimLabel(issuanceContext.issuanceClaim.verificationStatus)} tone="informational" />
                  <AnalysisStatusBadge label={claimLabel(issuanceContext.issuanceClaim.verificationMethod)} tone="informational" />
                </View>
              ) : null}
              <Text style={styles.muted}>Authority/control mechanism has not been independently verified.</Text>
            </View>
          ) : null}
        </SectionCard>

        <SectionCard>
          <AnalysisSectionHeader icon="concentration" title="TOKEN ACCOUNT CONCENTRATION" />
          <View style={styles.metricsGrid}>
            <View style={styles.metricCell}><Text style={styles.metricLabel}>LARGEST ACCOUNT</Text><Text style={styles.metricValue}>{pct(report.inspection.holderConcentration.topHolderPercentage)}</Text></View>
            <View style={styles.metricCell}><Text style={styles.metricLabel}>TOP 5 ACCOUNTS</Text><Text style={styles.metricValue}>{pct(report.inspection.holderConcentration.top5HoldersPercentage)}</Text></View>
            <View style={styles.metricCell}><Text style={styles.metricLabel}>TOP 10 ACCOUNTS</Text><Text style={styles.metricValue}>{pct(report.inspection.holderConcentration.top10HoldersPercentage)}</Text></View>
          </View>
          <Text style={styles.muted}>{report.inspection.holderConcentration.semanticsNote}</Text>
          {protocolAccounts.length ? (
            <View style={styles.rowBlock}>
              <Text style={styles.sectionCaption}>PROTOCOL ACCOUNT CONTEXT</Text>
              {protocolAccounts.map((account) => (
                <AnalysisFactRow
                  key={`protocol-account:${account.address}`}
                  label={account.classification.protocol ?? 'UNCLASSIFIED'}
                  value={pct(account.percentage)}
                  description={account.classification.classification}
                />
              ))}
            </View>
          ) : null}
          {unclassifiedAccounts.length ? (
            <View style={styles.rowBlock}>
              <Text style={styles.sectionCaption}>UNCLASSIFIED TOKEN ACCOUNTS</Text>
              {unclassifiedAccounts.map((account) => (
                <AnalysisFactRow
                  key={`unclassified-account:${account.address}`}
                  label="UNCLASSIFIED"
                  value={pct(account.percentage)}
                  description={account.address}
                  monospace
                  selectable
                />
              ))}
            </View>
          ) : null}
        </SectionCard>

        <SectionCard>
          <AnalysisSectionHeader icon="evidence" title="IDENTITY EVIDENCE" />
          {classification?.evidence?.length ? classification.evidence.map((entry, index) => (
            <AnalysisFactRow key={`identity-evidence:${entry}:${index}`} label="EVIDENCE" value={presentIdentityEvidence(entry)} />
          )) : <Text style={styles.muted}>No identity evidence entries available.</Text>}
          {report.provenance?.evidence?.length ? report.provenance.evidence.map((entry) => (
            <AnalysisFactRow key={`provenance-evidence:${entry.id}`} label="DETAIL" value={entry.detail} />
          )) : null}
        </SectionCard>

        <SectionCard>
          <AnalysisSectionHeader icon="provenance" title="TRUSTED IDENTITY PROVENANCE" />
          <Text style={styles.muted}>Identity confirmation means trusted sources associate this mint with the claimed token. It is not a safety or profitability verdict.</Text>
          <View style={styles.rowBlock}>
            <View style={styles.badgeRow}>
              <AnalysisStatusBadge label={trustedIdentityConclusion.title} tone={conclusionTone()} />
            </View>
            <Text style={styles.body}>{trustedIdentityConclusion.summary}</Text>
            <AnalysisFactRow label="TRUSTED SOURCES CHECKED" value={String(trustedIdentityConclusion.trustedSourcesChecked)} />
            <AnalysisFactRow label="EXACT MINT CONFIRMATIONS" value={String(trustedIdentityConclusion.exactMintConfirmations)} />
            <AnalysisFactRow label="CONFLICTING MINT REFERENCES" value={String(trustedIdentityConclusion.conflictingMintReferences)} valueTone={hasConflictingMintEvidence ? 'warning' : undefined} />
            {report.provenanceWarning ? <Text style={styles.warning}>{report.provenanceWarning}</Text> : null}
          </View>
          {provenanceItems.length === 0 ? <Text style={styles.muted}>No trusted identity sources were returned.</Text> : null}
          {provenanceItems.length > 0 && !hasConflictingMintEvidence ? (
            <PrimaryButton onPress={handleToggleSourceEvidence} variant="secondary">
              {showSourceEvidence ? 'HIDE SOURCE EVIDENCE' : 'VIEW SOURCE EVIDENCE'}
            </PrimaryButton>
          ) : null}
          <View style={styles.rowBlock}>
            {(hasConflictingMintEvidence || showSourceEvidence) ? provenanceItems.map((source) => (
              <ProvenanceSourceRow key={source.id} source={source} />
            )) : null}
          </View>
        </SectionCard>

      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  metricsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metricCell: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  metricLabel: {
    color: Colors.mutedText,
    fontSize: Typography.small,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: Colors.text,
    fontSize: Typography.heading,
    fontWeight: '900',
  },
  sectionCaption: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  body: {
    color: Colors.text,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  muted: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  warning: {
    color: Colors.warning,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  error: {
    color: Colors.negative,
    fontSize: Typography.small,
    fontWeight: '700',
  },
  rowBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
