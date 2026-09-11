import { ed25519 } from '@noble/curves/ed25519.js';
import { PublicKey } from '@solana/web3.js';

export type SignatureVerificationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid-public-key' | 'invalid-signature-length' | 'verification-failed';
      message: string;
    };

export function verifyMessageSignature(
  publicKeyBase58: string,
  messageBytes: Uint8Array,
  signatureBytes: Uint8Array,
): SignatureVerificationResult {
  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = new PublicKey(publicKeyBase58).toBytes();
  } catch {
    return {
      ok: false,
      reason: 'invalid-public-key',
      message: 'Connected wallet key is not a valid base58 public key.',
    };
  }

  if (signatureBytes.length !== 64) {
    return {
      ok: false,
      reason: 'invalid-signature-length',
      message: 'Signed message response has an invalid signature length.',
    };
  }

  try {
    const isValid = ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
    if (!isValid) {
      return {
        ok: false,
        reason: 'verification-failed',
        message: 'Signature does not match the requested message and wallet key.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'verification-failed',
      message: 'Signature verification failed.',
    };
  }
}
