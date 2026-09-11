import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWallet } from '@/hooks/useWallet';
import type { WalletSnapshotService } from '@/services/solana/walletSnapshotService';
import { walletSnapshotService } from '@/services/solana/walletSnapshotService';
import type { SolanaNetwork, WalletSnapshot } from '@/types/walletSnapshot';

export type WalletSnapshotStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseWalletSnapshotOptions {
  service?: WalletSnapshotService;
  autoFetch?: boolean;
}

interface WalletSnapshotController {
  network: SolanaNetwork;
  endpoint: string;
  address: string | null;
  isConnected: boolean;
  status: WalletSnapshotStatus;
  snapshot: WalletSnapshot | null;
  error: string | null;
  refresh: () => Promise<boolean>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Wallet snapshot failed. Please try again.';
}

export function useWalletSnapshot({ service = walletSnapshotService, autoFetch = true }: UseWalletSnapshotOptions = {}): WalletSnapshotController {
  const { status: walletStatus, wallet } = useWallet();
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [status, setStatus] = useState<WalletSnapshotStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const address = useMemo(() => {
    if (walletStatus !== 'connected') return null;
    const normalized = wallet?.address?.trim();
    return normalized ? normalized : null;
  }, [wallet?.address, walletStatus]);

  const isConnected = Boolean(address);
  const visibleSnapshot = address && snapshot?.address === address ? snapshot : null;
  const visibleError = address ? error : null;
  const visibleStatus: WalletSnapshotStatus = !address ? 'idle' : status;

  const fetchSnapshot = useCallback(async (targetAddress: string): Promise<boolean> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    setError(null);

    try {
      const nextSnapshot = await service.getSnapshot(targetAddress);
      if (requestId !== requestIdRef.current) return false;

      if (nextSnapshot.address !== targetAddress) {
        setSnapshot(null);
        setStatus('error');
        setError('Wallet snapshot response did not match the connected wallet. Please refresh.');
        return false;
      }

      setSnapshot(nextSnapshot);
      setStatus('success');
      return true;
    } catch (nextError) {
      if (requestId !== requestIdRef.current) return false;
      setSnapshot(null);
      setStatus('error');
      setError(getErrorMessage(nextError));
      return false;
    }
  }, [service]);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    return await fetchSnapshot(address);
  }, [address, fetchSnapshot]);

  useEffect(() => {
    requestIdRef.current += 1;
    if (!address || !autoFetch) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void fetchSnapshot(address);
    });

    return () => {
      cancelled = true;
    };
  }, [address, autoFetch, fetchSnapshot]);

  return {
    network: service.network,
    endpoint: service.endpoint,
    address,
    isConnected,
    status: visibleStatus,
    snapshot: visibleSnapshot,
    error: visibleError,
    refresh,
  };
}
