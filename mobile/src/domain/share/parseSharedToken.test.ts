import { describe, expect, it } from 'vitest';

import { parseSharedToken, shareParserLimits } from '@/domain/share/parseSharedToken';

const JUP_MINT = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

describe('parseSharedToken', () => {
  it('parses a raw JUP mint', () => {
    expect(parseSharedToken({ text: JUP_MINT })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('parses pump.fun /coin/<mint> URL', () => {
    expect(parseSharedToken({ text: `https://pump.fun/coin/${JUP_MINT}` })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('parses pump.fun URL with query parameters', () => {
    expect(parseSharedToken({ text: `https://pump.fun/coin/abc123?mint=${JUP_MINT}&utm_source=x` })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('parses trailing slash URL form', () => {
    expect(parseSharedToken({ text: `https://pump.fun/coin/${JUP_MINT}/` })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('parses www.pump.fun host', () => {
    expect(parseSharedToken({ text: `https://www.pump.fun/coin/${JUP_MINT}` })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('parses browser title with pump.fun URL in text', () => {
    expect(parseSharedToken({ text: `Some Token https://pump.fun/coin/${JUP_MINT}` })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('parses one valid-looking mint from arbitrary text', () => {
    expect(parseSharedToken({ text: `check this later: ${JUP_MINT} from chat` })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('returns none for invalid input text', () => {
    expect(parseSharedToken({ text: 'hello world not a mint' })).toEqual({ kind: 'none' });
  });

  it('returns multiple for multiple candidate addresses', () => {
    expect(parseSharedToken({ text: `${JUP_MINT} and ${SOL_MINT}` })).toEqual({ kind: 'multiple', mints: [JUP_MINT, SOL_MINT] });
  });

  it('deduplicates duplicate occurrences of the same mint', () => {
    expect(parseSharedToken({ text: `${JUP_MINT} ... ${JUP_MINT}` })).toEqual({ kind: 'single', mint: JUP_MINT });
  });

  it('handles oversized and malformed payload safely', () => {
    const hugePrefix = 'x'.repeat(shareParserLimits.maxSharedTextLength + 500);
    const result = parseSharedToken({
      text: `${hugePrefix}${JUP_MINT}`,
      webUrl: 'not a url::://',
      title: null,
    });

    expect(result).toEqual({ kind: 'none' });
  });
});
