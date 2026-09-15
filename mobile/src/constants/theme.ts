/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

export const Colors = {
  background: '#090B10',
  card: '#131720',
  secondaryCard: '#1B2130',
  accent: '#7C5CFF',
  positive: '#32D583',
  negative: '#F97066',
  text: '#FFFFFF',
  secondaryText: '#B0BACB',
  mutedText: '#8490A3',
  border: '#252B38',
  warning: '#FEC84B',
  securityChallengeBackdrop: 'rgba(0, 0, 0, 0.86)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const LayoutSpacing = {
  pageHorizontal: Spacing.lg,
  pageTop: Spacing.lg,
  pageSectionGap: Spacing.xl,
  pageBottomInset: Spacing.xl,
  cardPadding: Spacing.lg,
  cardSectionGap: Spacing.lg,
  buttonGroupGap: Spacing.sm,
  fieldGap: Spacing.sm,
} as const;

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const Typography = {
  title: 28,
  heading: 20,
  body: 16,
  small: 14,
  label: 14,
} as const;

export const TypographyLineHeight = {
  title: 34,
  heading: 26,
  body: 22,
  small: 19,
  label: 19,
} as const;

export const Training = {
  xpPerLevel: 1000,
  correctSkillPoints: 2,
  incorrectSkillPoints: -1,
  maxHistoryEntries: 10,
  dailyGoal: 3,
  dailyCompletionBonusXp: 150,
} as const;

export type ThemeColor =
  | 'text'
  | 'background'
  | 'secondaryText'
  | 'textSecondary'
  | 'backgroundElement'
  | 'backgroundSelected'
  | 'card'
  | 'accent';

export const Fonts = {
  sans: 'sans-serif',
  serif: 'serif',
  rounded: 'sans-serif',
  mono: 'monospace',
} as const;

export const BottomTabInset = 80;
export const MaxContentWidth = 800;
