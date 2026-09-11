import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWalletSafetyInspectionContext } from '@/context/WalletSafetyInspectionContext';
import { useWallet } from '@/hooks/useWallet';
import type { WalletInspectionService } from '@/services/solana/walletInspectionService';
import { walletInspectionService } from '@/services/solana/walletInspectionService';
import type { SolanaNetwork } from '@/types/walletSnapshot';
import type { WalletSafetyInspection } from '@/types/walletInspection';

export type WalletInspectionStatus = 'idle' | 'loading' | 'success' | 'partial' | 'unavailable';
export type WalletInspectionViewMode = 'review' | 'informational' | 'all';

interface UseWalletSafetyInspectionOptions {
  service?: WalletInspectionService;
  autoFetch?: boolean;
}

interface WalletSafetyInspectionController {
  network: SolanaNetwork;
  endpoint: string;
  address: string | null;
  isConnected: boolean;
  status: WalletInspectionStatus;
  viewMode: WalletInspectionViewMode;
  inspection: WalletSafetyInspection | null;
  error: string | null;
  setViewMode: (mode: WalletInspectionViewMode) => void;
  refresh: () => Promise<boolean>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Wallet inspection failed. Please try again.';
}

export function useWalletSafetyInspection({
  service = walletInspectionService,
  autoFetch = true,
}: UseWalletSafetyInspectionOptions = {}): WalletSafetyInspectionController {
  const { status: walletStatus, wallet } = useWallet();
  const { inspectionsByAddress, saveInspection } = useWalletSafetyInspectionContext();
  const [status, setStatus] = useState<WalletInspectionStatus>('idle');
  const [viewModeByAddress, setViewModeByAddress] = useState<Record<string, WalletInspectionViewMode>>({});
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const address = useMemo(() => {
    if (walletStatus !== 'connected') return null;
    const normalized = wallet?.address?.trim();
    return normalized ? normalized : null;
  }, [wallet?.address, walletStatus]);

  const isConnected = Boolean(address);
  const visibleInspection = address ? (inspectionsByAddress[address] ?? null) : null;
  const visibleError = address ? error : null;
  const visibleStatus: WalletInspectionStatus = !address ? 'idle' : status;
  const viewMode: WalletInspectionViewMode = address ? (viewModeByAddress[address] ?? 'review') : 'review';

  const setViewMode = useCallback((mode: WalletInspectionViewMode) => {
    if (!address) return;
    setViewModeByAddress((current) => {
      if (current[address] === mode) return current;
      return {
        ...current,
        [address]: mode,
      };
    });
  }, [address]);

  const fetchInspection = useCallback(async (targetAddress: string): Promise<boolean> => {
    if (inFlightRef.current) return false;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightRef.current = true;
    setStatus('loading');
    setError(null);

    try {
      const nextInspection = await service.getInspection(targetAddress);
      if (requestId !== requestIdRef.current) return false;

      if (nextInspection.address !== targetAddress) {
        setStatus('unavailable');
        setError('Wallet inspection response did not match the connected wallet. Please refresh.');
        return false;
      }

      setViewModeByAddress((current) => {
        if (current[targetAddress] === 'review' || current[targetAddress] === undefined) return current;
        return { ...current, [targetAddress]: 'review' };
      });
      saveInspection(nextInspection);
      setStatus(nextInspection.warnings.length > 0 ? 'partial' : 'success');
      return true;
    } catch (nextError) {
      if (requestId !== requestIdRef.current) return false;
      setStatus('unavailable');
      setError(getErrorMessage(nextError));
      return false;
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
      }
    }
  }, [saveInspection, service]);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    return await fetchInspection(address);
  }, [address, fetchInspection]);

  useEffect(() => {
    requestIdRef.current += 1;
    inFlightRef.current = false;
    if (!address || !autoFetch) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void fetchInspection(address);
    });

    return () => {
      cancelled = true;
    };
  }, [address, autoFetch, fetchInspection]);

  return {
    network: service.network,
    endpoint: service.endpoint,
    address,
    isConnected,
    status: visibleStatus,
    viewMode,
    inspection: visibleInspection,
    error: visibleError,
    setViewMode,
    refresh,
  };
}
