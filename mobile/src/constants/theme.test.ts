import { describe, expect, it } from 'vitest';

import { Colors, Typography, TypographyLineHeight } from './theme';

describe('theme typography contract', () => {
  it('provides readable semantic sizes and matching line heights', () => {
    expect(Typography.small).toBe(14);
    expect(Typography.body).toBe(16);
    expect(Typography.heading).toBe(20);
    expect(Typography.title).toBe(28);
    expect(TypographyLineHeight.small).toBeGreaterThan(Typography.small);
    expect(TypographyLineHeight.body).toBeGreaterThan(Typography.body);
    expect(TypographyLineHeight.heading).toBeGreaterThan(Typography.heading);
    expect(TypographyLineHeight.title).toBeGreaterThan(Typography.title);
  });

  it('keeps secondary and muted text distinguishable from the dark surfaces', () => {
    expect(Colors.secondaryText).toBe('#B0BACB');
    expect(Colors.mutedText).toBe('#8490A3');
  });
});