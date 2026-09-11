import { ed25519 } from '@noble/curves/ed25519.js';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import { verifyMessageSignature } from './verifyMessageSignature';

describe('verifyMessageSignature', () => {
  const privateKey = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));
  const secondaryPrivateKey = Uint8Array.from(Array.from({ length: 32 }, (_, index) => 200 - index));
  const publicKeyBytes = ed25519.getPublicKey(privateKey);
  const secondaryPublicKeyBytes = ed25519.getPublicKey(secondaryPrivateKey);
  const publicKey = new PublicKey(publicKeyBytes).toBase58();
  const wrongValidPublicKey = new PublicKey(secondaryPublicKeyBytes).toBase58();
  const message = new TextEncoder().encode('TrainRekt signing verification fixture');
  const signature = ed25519.sign(message, privateKey);

  it('verifies a valid Ed25519 signature', () => {
    const result = verifyMessageSignature(publicKey, message, signature);
    expect(result).toEqual({ ok: true });
  });

  it('fails when message changes', () => {
    const tamperedMessage = new TextEncoder().encode('TrainRekt signing verification fixture changed');
    const result = verifyMessageSignature(publicKey, tamperedMessage, signature);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failed verification.');
    expect(result.reason).toBe('verification-failed');
  });

  it('fails when signature changes', () => {
    const tamperedSignature = signature.slice();
    tamperedSignature[0] ^= 0xff;
    const result = verifyMessageSignature(publicKey, message, tamperedSignature);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failed verification.');
    expect(result.reason).toBe('verification-failed');
  });

  it('fails safely for malformed public key', () => {
    const result = verifyMessageSignature('not-base58', message, signature);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failed verification.');
    expect(result.reason).toBe('invalid-public-key');
  });

  it('fails verification with a syntactically valid but wrong public key', () => {
    const result = verifyMessageSignature(wrongValidPublicKey, message, signature);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failed verification.');
    expect(result.reason).toBe('verification-failed');
  });

  it('fails safely for invalid signature length', () => {
    const result = verifyMessageSignature(publicKey, message, new Uint8Array([1, 2, 3]));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failed verification.');
    expect(result.reason).toBe('invalid-signature-length');
  });
});
