import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';

import type { ConnectedWallet, WalletConnectResult, WalletConnectionFailureReason, WalletDisconnectResult, WalletSignMessageFailureReason, WalletSignMessageResult } from '@/types/wallet';
import { normalizeMwaAccountAddress } from '@/domain/wallet/normalizeMwaAccountAddress';
import { toMwaBase64Address } from '@/domain/wallet/toMwaBase64Address';
import { verifyMessageSignature } from '@/domain/wallet/verifyMessageSignature';
import type { MobileWalletService } from './mobileWalletService';

const APP_IDENTITY = {
  name: 'TrainRekt',
  // Development-safe URI until a production domain and digital asset links are configured.
  uri: 'https://localhost',
};

function toMessage(reason: WalletConnectionFailureReason): string {
  if (reason === 'cancelled') return 'Wallet connection cancelled.';
  if (reason === 'rejected') return 'Wallet authorization was rejected.';
  if (reason === 'no-wallet') return 'No compatible Solana wallet was found on this device.';
  if (reason === 'unavailable') return 'Wallet adapter is unavailable on this device.';
  if (reason === 'unsupported') return 'Wallet connection is only available on Android development builds.';
  return 'Wallet connection failed. Please try again.';
}

function toSignMessage(reason: WalletSignMessageFailureReason): string {
  if (reason === 'cancelled') return 'Message signing was cancelled.';
  if (reason === 'rejected') return 'Message signing was rejected.';
  if (reason === 'unsupported') return 'Message signing is only available on Android development builds.';
  if (reason === 'unavailable') return 'Message signing is unavailable on this device.';
  if (reason === 'account-mismatch') return 'Wallet account does not match the connected identity.';
  if (reason === 'invalid-wallet') return 'Connected wallet address is invalid.';
  if (reason === 'invalid-response') return 'Wallet returned an invalid signed message response.';
  if (reason === 'verification-failed') return 'Signed message could not be verified against the connected wallet key.';
  return 'Message signing failed. Please try again.';
}

class WalletSignFlowError extends Error {
  constructor(readonly reason: WalletSignMessageFailureReason) {
    super(reason);
  }
}

function mapError(error: unknown): { reason: WalletConnectionFailureReason; message: string } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Unknown wallet error');
  const message = rawMessage.toLowerCase();

  if (message.includes('cancel') || message.includes('dismissed')) {
    return { reason: 'cancelled', message: toMessage('cancelled') };
  }

  if (message.includes('reject') || message.includes('declin') || message.includes('denied')) {
    return { reason: 'rejected', message: toMessage('rejected') };
  }

  if (message.includes('no wallet') || message.includes('not found') || message.includes('no compatible') || message.includes('activitynotfound')) {
    return { reason: 'no-wallet', message: toMessage('no-wallet') };
  }

  if (message.includes('unsupported')) {
    return { reason: 'unsupported', message: toMessage('unsupported') };
  }

  if (message.includes('unavailable')) {
    return { reason: 'unavailable', message: toMessage('unavailable') };
  }

  return { reason: 'failed', message: toMessage('failed') };
}

function mapSignMessageError(error: unknown): { reason: WalletSignMessageFailureReason; message: string } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Unknown wallet error');
  const message = rawMessage.toLowerCase();

  if (message.includes('cancel') || message.includes('dismissed')) {
    return { reason: 'cancelled', message: toSignMessage('cancelled') };
  }
  if (message.includes('reject') || message.includes('declin') || message.includes('denied') || message.includes('not signed')) {
    return { reason: 'rejected', message: toSignMessage('rejected') };
  }
  if (message.includes('unsupported')) {
    return { reason: 'unsupported', message: toSignMessage('unsupported') };
  }
  if (message.includes('unavailable')) {
    return { reason: 'unavailable', message: toSignMessage('unavailable') };
  }
  return { reason: 'failed', message: toSignMessage('failed') };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function normalizeSignedMessageResponse(message: Uint8Array, signedPayload: Uint8Array): WalletSignMessageResult {
  if (signedPayload.length === 64) {
    return { ok: true, signatureBytes: signedPayload };
  }
  if (signedPayload.length < 64) {
    return { ok: false, reason: 'invalid-response', message: toSignMessage('invalid-response') };
  }

  const signedMessage = signedPayload.slice(0, signedPayload.length - 64);
  const signatureBytes = signedPayload.slice(signedPayload.length - 64);
  if (!bytesEqual(signedMessage, message)) {
    return { ok: false, reason: 'invalid-response', message: toSignMessage('invalid-response') };
  }

  return { ok: true, signatureBytes };
}

function normalizeConnectedWalletAddress(address: string): string {
  try {
    return new PublicKey(address.trim()).toBase58();
  } catch {
    throw new WalletSignFlowError('invalid-wallet');
  }
}

function validateAuthorizedSigner(
  authorizationResult: { accounts: { address: string }[] },
  expectedWalletAddress: string,
): void {
  if (!Array.isArray(authorizationResult.accounts) || authorizationResult.accounts.length !== 1) {
    throw new WalletSignFlowError('invalid-response');
  }

  const account = authorizationResult.accounts[0];
  if (!account || typeof account.address !== 'string') {
    throw new WalletSignFlowError('invalid-response');
  }

  let authorizedAddress: string;
  try {
    authorizedAddress = normalizeMwaAccountAddress(account.address);
  } catch {
    throw new WalletSignFlowError('invalid-response');
  }

  if (authorizedAddress !== expectedWalletAddress) {
    throw new WalletSignFlowError('account-mismatch');
  }
}

function firstAuthorizedWallet(authorizationResult: {
  accounts: { address: string; label?: string; display_address?: string }[];
  auth_token?: string;
}): { ok: true; wallet: ConnectedWallet; authToken?: string } | { ok: false; message: string } {
  const account = authorizationResult.accounts[0];
  if (!account) {
    return {
      ok: false,
      message: 'Wallet authorization did not return an account.',
    };
  }

  let canonicalAddress: string;
  try {
    canonicalAddress = normalizeMwaAccountAddress(account.address);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Wallet returned an invalid account address.',
    };
  }

  return {
    ok: true,
    wallet: {
      address: canonicalAddress,
      label: account.label,
    },
    authToken: authorizationResult.auth_token,
  };
}

export const mobileWalletServiceImpl: MobileWalletService = {
  async connectWallet(): Promise<WalletConnectResult> {
    try {
      const authorizationResult = await transact(async (wallet: Web3MobileWallet) => {
        return await wallet.authorize({
          chain: 'solana:mainnet',
          identity: APP_IDENTITY,
        });
      });

      const authorizedWallet = firstAuthorizedWallet(authorizationResult);
      if (!authorizedWallet.ok) {
        return {
          ok: false,
          reason: 'failed',
          message: authorizedWallet.message,
        };
      }

      return { ok: true, wallet: authorizedWallet.wallet, authToken: authorizedWallet.authToken };
    } catch (error) {
      const mapped = mapError(error);
      return { ok: false, reason: mapped.reason, message: mapped.message };
    }
  },

  async disconnectWallet(authToken?: string): Promise<WalletDisconnectResult> {
    if (!authToken) return { ok: true };

    // SECURITY TEMPORARY: deauthorize is disabled because upstream/native MWA
    // logging was observed exposing raw auth tokens in Android logcat.
    // Re-enable only after verified-safe upstream behavior.
    return { ok: true };
  },

  async signMessage(message: Uint8Array, walletAddress: string, authToken?: string): Promise<WalletSignMessageResult> {
    let address: string;
    let expectedWalletAddress: string;
    try {
      address = toMwaBase64Address(walletAddress);
      expectedWalletAddress = normalizeConnectedWalletAddress(walletAddress);
    } catch {
      return { ok: false, reason: 'invalid-wallet', message: toSignMessage('invalid-wallet') };
    }

    try {
      const signedPayloads = await transact(async (wallet: Web3MobileWallet): Promise<Uint8Array[]> => {
        const authorizationResult = authToken
          ? await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY })
          : await wallet.authorize({ chain: 'solana:mainnet', identity: APP_IDENTITY });

        validateAuthorizedSigner(authorizationResult, expectedWalletAddress);
        return await wallet.signMessages({ addresses: [address], payloads: [message] });
      });

      if (!Array.isArray(signedPayloads) || signedPayloads.length !== 1) {
        return { ok: false, reason: 'invalid-response', message: toSignMessage('invalid-response') };
      }

      const signedPayload = signedPayloads[0];
      if (!(signedPayload instanceof Uint8Array)) {
        return { ok: false, reason: 'invalid-response', message: toSignMessage('invalid-response') };
      }

      const normalizedResult = normalizeSignedMessageResponse(message, signedPayload);
      if (!normalizedResult.ok) return normalizedResult;

      const verification = verifyMessageSignature(
        expectedWalletAddress,
        message,
        normalizedResult.signatureBytes,
      );
      if (!verification.ok) {
        return {
          ok: false,
          reason: 'verification-failed',
          message: toSignMessage('verification-failed'),
        };
      }

      return normalizedResult;
    } catch (error) {
      if (error instanceof WalletSignFlowError) {
        return { ok: false, reason: error.reason, message: toSignMessage(error.reason) };
      }
      const mapped = mapSignMessageError(error);
      return { ok: false, reason: mapped.reason, message: mapped.message };
    }
  },
};
