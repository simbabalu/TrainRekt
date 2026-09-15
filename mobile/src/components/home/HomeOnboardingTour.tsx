import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, Image } from 'react-native';

import { Colors, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { homeOnboardingTourLogo } from '@/components/home/homeOnboardingTourLogo';

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HomeOnboardingTourProps {
  visible: boolean;
  stepIndex: number;
  spotlightRect: SpotlightRect | null;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
}

const steps = [
  {
    title: 'Welcome to TrainRekt',
    body: 'TrainRekt trains the human behind the wallet. Learn to recognize scams, risky signatures and unsafe Web3 decisions.',
    progress: '1 / 4',
  },
  {
    title: 'Token Safety Check',
    body: 'Inspect a Solana token before you interact with it. TrainRekt analyzes on-chain risk signals and helps you understand what to check.',
    progress: '2 / 4',
  },
  {
    title: 'Wallet Safety',
    body: 'Connect your wallet to inspect security signals and get training recommendations based on your wallet context.',
    progress: '3 / 4',
  },
  {
    title: 'Train. Improve. Stay safer.',
    body: 'Practice realistic security decisions. TrainRekt adapts training to the skills you need to improve.',
    progress: '4 / 4',
  },
] as const;

const overlayColor = 'rgba(5, 11, 24, 0.84)';
const spotlightPadding = 10;

export function HomeOnboardingTour({
  visible,
  stepIndex,
  spotlightRect,
  onSkip,
  onNext,
  onBack,
  onFinish,
}: HomeOnboardingTourProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const step = steps[stepIndex] ?? steps[0];
  const spotlight = stepIndex > 0 ? normalizeSpotlightRect(spotlightRect, screenWidth, screenHeight) : null;
  const cardStyle = stepIndex > 0 ? positionCardNearSpotlight(spotlight, screenHeight) : styles.cardCentered;

  return (
    <Modal animationType="fade" onRequestClose={onSkip} transparent visible={visible}>
      <View style={styles.overlayRoot}>
        <Pressable accessibilityLabel="Tour overlay blocker" onPress={() => undefined} style={styles.overlayTouchCatcher} />
        {spotlight ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: spotlight.top }]} />
            <View style={[styles.dim, { top: spotlight.top, left: 0, width: spotlight.left, height: spotlight.height }]} />
            <View style={[styles.dim, { top: spotlight.top, left: spotlight.left + spotlight.width, right: 0, height: spotlight.height }]} />
            <View style={[styles.dim, { top: spotlight.top + spotlight.height, left: 0, right: 0, bottom: 0 }]} />
            <Pressable accessibilityLabel="Tour spotlight touch blocker" onPress={() => undefined} style={[styles.touchBlocker, spotlight]} />
            <View pointerEvents="none" style={[styles.spotlightFrame, spotlight]} />
          </>
        ) : (
          <View style={styles.fullDim} />
        )}

            <View accessibilityLabel={`Home onboarding step ${step.progress}`} accessibilityViewIsModal accessible style={[styles.card, cardStyle]}>
          {stepIndex === 0 ? <Image accessibilityLabel="TrainRekt onboarding logo" source={homeOnboardingTourLogo} style={styles.welcomeLogo} /> : null}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          <View style={styles.footer}>
            <Text style={styles.progress}>{step.progress}</Text>
            <View style={styles.controls}>
              {stepIndex > 0 ? (
                <Pressable accessibilityLabel="Go to previous onboarding step" accessibilityRole="button" onPress={onBack} style={[styles.actionButton, styles.secondaryAction]}>
                  <Text style={styles.secondaryActionLabel}>BACK</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityLabel="Skip app tour" accessibilityRole="button" onPress={onSkip} style={[styles.actionButton, styles.secondaryAction]}>
                  <Text style={styles.secondaryActionLabel}>SKIP</Text>
                </Pressable>
              )}
              {stepIndex === 3 ? (
                <Pressable accessibilityLabel="Finish app tour" accessibilityRole="button" onPress={onFinish} style={[styles.actionButton, styles.primaryAction]}>
                  <Text style={styles.primaryActionLabel}>FINISH</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityLabel="Next onboarding step" accessibilityRole="button" onPress={onNext} style={[styles.actionButton, styles.primaryAction]}>
                  <Text style={styles.primaryActionLabel}>NEXT</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function normalizeSpotlightRect(rect: SpotlightRect | null, screenWidth: number, screenHeight: number) {
  if (!rect) return null;
  if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;

  const left = Math.max(0, rect.x - spotlightPadding);
  const top = Math.max(0, rect.y - spotlightPadding);
  const width = Math.min(screenWidth - left, rect.width + spotlightPadding * 2);
  const height = Math.min(screenHeight - top, rect.height + spotlightPadding * 2);

  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
}

function positionCardNearSpotlight(
  spotlight: { left: number; top: number; width: number; height: number } | null,
  screenHeight: number,
) {
  if (!spotlight) {
    return styles.cardCentered;
  }

  const estimatedCardHeight = 250;
  const minTop = 20;
  const maxTop = Math.max(minTop, screenHeight - estimatedCardHeight - 20);
  const belowTop = spotlight.top + spotlight.height + 14;
  const aboveTop = spotlight.top - estimatedCardHeight - 14;
  const top = belowTop <= maxTop ? belowTop : Math.max(minTop, aboveTop);

  return { top };
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
  },
  overlayTouchCatcher: {
      ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  fullDim: {
      ...StyleSheet.absoluteFill,
    backgroundColor: overlayColor,
  },
  dim: {
    position: 'absolute',
    backgroundColor: overlayColor,
  },
  touchBlocker: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderRadius: Radius.lg,
  },
  spotlightFrame: {
    position: 'absolute',
    borderColor: Colors.accent,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  card: {
    left: Spacing.lg,
    right: Spacing.lg,
    position: 'absolute',
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardCentered: {
    top: '50%',
    transform: [{ translateY: -140 }],
  },
  welcomeLogo: {
    alignSelf: 'center',
    width: 72,
    height: 72,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.heading,
    lineHeight: TypographyLineHeight.heading,
    fontWeight: '900',
  },
  body: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  footer: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  progress: {
    color: Colors.mutedText,
    fontSize: Typography.small,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondaryCard,
    flex: 1,
  },
  primaryAction: {
    backgroundColor: Colors.accent,
    flex: 1,
  },
  secondaryActionLabel: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  primaryActionLabel: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});