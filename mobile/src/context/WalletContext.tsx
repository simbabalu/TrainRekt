import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { mobileWalletService, MobileWalletService } from '@/services/wallet/mobileWalletService';
import { buildTrainingSigningMessage, createRandomTrainingSigningNonce, TrainingSigningMessage } from '@/domain/wallet/buildTrainingSigningMessage';
import { REAL_MESSAGE_SIGNING_DISABLED_MESSAGE, REAL_MESSAGE_SIGNING_ENABLED } from '@/security/realMessageSigning';
import { ConnectedWallet, WalletConnectionStatus, WalletSignMessageResult } from '@/types/wallet';

function isDevRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

interface WalletContextValue {
  status: WalletConnectionStatus;
  wallet: ConnectedWallet | null;
  error: string | null;
  realMessageSigningEnabled: boolean;
  trainingSigningMessage: TrainingSigningMessage;
  signingStatus: 'idle' | 'signing';
  signingError: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTrainingMessage: () => Promise<WalletSignMessageResult>;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

interface WalletProviderProps extends PropsWithChildren {
  service?: MobileWalletService;
}

export function WalletProvider({ children, service = mobileWalletService }: WalletProviderProps) {
  const [status, setStatus] = useState<WalletConnectionStatus>('disconnected');
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingStatus, setSigningStatus] = useState<'idle' | 'signing'>('idle');
  const [signingError, setSigningError] = useState<string | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const pendingConnectRef = useRef(false);
  const trainingSigningMessage = useMemo(
    () => buildTrainingSigningMessage(createRandomTrainingSigningNonce()),
    [],
  );

  useEffect(() => {
    if (!isDevRuntime()) return;
    console.log(`[WALLET] status=${status}`);
  }, [status]);

  async function connect() {
    if (pendingConnectRef.current) return;
    pendingConnectRef.current = true;
    setStatus('connecting');
    setError(null);

    try {
      const result = await service.connectWallet();
      if (!result.ok) {
        if (result.reason === 'cancelled') {
          setStatus('disconnected');
        } else {
          setStatus('error');
        }
        setError(result.message);
        setWallet(null);
        authTokenRef.current = null;
        return;
      }

      setWallet(result.wallet);
      authTokenRef.current = result.authToken ?? null;
      setError(null);
      setStatus('connected');
    } finally {
      pendingConnectRef.current = false;
    }
  }

  async function disconnect() {
    if (status === 'connecting') return;

    const result = await service.disconnectWallet(authTokenRef.current ?? undefined);
    if (!result.ok) {
      setStatus('error');
      setError(result.message);
      return;
    }

    authTokenRef.current = null;
    setWallet(null);
    setError(null);
    setStatus('disconnected');
  }

  async function signTrainingMessage(): Promise<WalletSignMessageResult> {
    if (!REAL_MESSAGE_SIGNING_ENABLED) {
      return {
        ok: false,
        reason: 'disabled',
        message: REAL_MESSAGE_SIGNING_DISABLED_MESSAGE,
      };
    }

    if (!wallet) {
      return {
        ok: false,
        reason: 'invalid-wallet',
        message: 'Connect a wallet before signing a training message.',
      };
    }

    setSigningStatus('signing');
    setSigningError(null);

    try {
      const result = await service.signMessage(
        trainingSigningMessage.messageBytes,
        wallet.address,
        authTokenRef.current ?? undefined,
      );
      if (!result.ok) setSigningError(result.message);
      return result;
    } finally {
      setSigningStatus('idle');
    }
  }

  return (
    <WalletContext.Provider
      value={{
        status,
        wallet,
        error,
        realMessageSigningEnabled: REAL_MESSAGE_SIGNING_ENABLED,
        trainingSigningMessage,
        signingStatus,
        signingError,
        connect,
        disconnect,
        signTrainingMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
