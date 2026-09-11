import { describe, expect, it } from 'vitest';

import {
  buildTrainingSigningMessage,
  buildTrainingSigningMessageText,
  createRandomTrainingSigningNonce,
  createTrainingSigningNonce,
} from './buildTrainingSigningMessage';

describe('buildTrainingSigningMessage', () => {
  it('builds the exact training message format with nonce', () => {
    const nonce = '001122aabb';
    const message = buildTrainingSigningMessageText(nonce);

    expect(message).toBe(
      'TrainRekt Wallet Safety Training\n\n' +
        'I am signing this message only to learn how Solana message signatures work.\n\n' +
        'This message does not authorize:\n' +
        '- a token transfer\n' +
        '- a transaction\n' +
        '- spending authority\n' +
        '- account ownership changes\n\n' +
        'Training nonce: 001122aabb',
    );
  });

  it('encodes UTF-8 bytes that decode back to the exact display message', () => {
    const built = buildTrainingSigningMessage('deadbeef');
    const decoded = new TextDecoder().decode(built.messageBytes);

    expect(decoded).toBe(built.displayMessage);
    expect(decoded).toContain('Training nonce: deadbeef');
  });

  it('creates nonce from bytes and deterministic random source', () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    expect(createTrainingSigningNonce(bytes)).toBe('000102ff');

    const nonce = createRandomTrainingSigningNonce((buffer) => {
      buffer.set([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 17, 34]);
      return buffer;
    });
    expect(nonce).toBe('090807060504030201001122');
  });
});
