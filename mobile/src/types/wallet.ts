export type WalletConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectedWallet {
  address: string;
  label?: string;
}

export type WalletConnectionFailureReason =
  | 'cancelled'
  | 'rejected'
  | 'no-wallet'
  | 'unavailable'
  | 'unsupported'
  | 'failed';

export type WalletConnectResult =
  | { ok: true; wallet: ConnectedWallet; authToken?: string }
  | { ok: false; reason: WalletConnectionFailureReason; message: string };

export type WalletDisconnectResult =
  | { ok: true }
  | { ok: false; reason: WalletConnectionFailureReason; message: string };
