import { describe, expect, it } from 'vitest';

import { REAL_MESSAGE_SIGNING_DISABLED_MESSAGE, REAL_MESSAGE_SIGNING_ENABLED } from './realMessageSigning';

describe('realMessageSigning gate', () => {
  it('is disabled by default', () => {
    expect(REAL_MESSAGE_SIGNING_ENABLED).toBe(false);
  });

  it('exposes the stable disabled-state message', () => {
    expect(REAL_MESSAGE_SIGNING_DISABLED_MESSAGE).toBe(
      'Real wallet signing is disabled while TrainRekt is being validated.',
    );
  });
});
