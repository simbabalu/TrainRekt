import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

import type { ConnectedWallet, WalletConnectResult, WalletConnectionFailureReason, WalletDisconnectResult } from '@/types/wallet';
import { normalizeMwaAccountAddress } from '@/domain/wallet/normalizeMwaAccountAddress';
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
};
