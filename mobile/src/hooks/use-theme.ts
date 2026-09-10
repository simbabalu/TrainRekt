/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
export function useTheme() {
  return {
    text: Colors.text,
    background: Colors.background,
    secondaryText: Colors.secondaryText,
      textSecondary: Colors.secondaryText,
      backgroundElement: Colors.card,
      backgroundSelected: Colors.secondaryCard,
    card: Colors.card,
    accent: Colors.accent,
  };
}
