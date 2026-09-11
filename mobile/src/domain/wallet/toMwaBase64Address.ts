import { base64FromUint8Array } from '@solana-mobile/mobile-wallet-adapter-protocol/encoding';
import { PublicKey } from '@solana/web3.js';

export function toMwaBase64Address(address: string): string {
  const normalized = address.trim();

  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(normalized);
  } catch {
    throw new Error('Wallet address is not a valid base58 public key.');
  }

  const bytes = publicKey.toBytes();
  if (bytes.length !== 32) {
    throw new Error('Wallet address has an invalid byte length.');
  }

  return base64FromUint8Array(bytes);
}
