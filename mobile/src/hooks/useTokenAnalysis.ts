import { useCallback, useEffect, useRef, useState } from 'react';

import type { TokenInspectionApiService } from '@/services/api/tokenInspectionApiService';
import { tokenInspectionApiService } from '@/services/api/tokenInspectionApiService';
import {
  TokenAnalysisAiStatus,
  TokenAnalysisDeterministicStatus,
  TokenAnalysisReport,
  TokenInspectionApiError,
  TokenInspectionCoachResponse,
} from '@/types/tokenAnalysis';

interface UseTokenAnalysisOptions {
  service?: TokenInspectionApiService;
}

interface TokenAnalysisController {
  mintInput: string;
  setMintInput: (value: string) => void;
  deterministicStatus: TokenAnalysisDeterministicStatus;
  aiStatus: TokenAnalysisAiStatus;
  report: TokenAnalysisReport | null;
  coach: TokenInspectionCoachResponse['coach'];
  validationError: string | null;
  deterministicError: string | null;
  aiError: string | null;
  analyzeToken: (mintOverride?: string) => Promise<void>;
  explainWithAi: () => Promise<void>;
  clearInput: () => void;
}

const BASE58_MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function elapsedMs(startedAtMs: number): number {
  return Math.max(0, Math.round(nowMs() - startedAtMs));
}

function normalizeMint(value: string): string {
  return value.trim();
}

function validateMintInput(value: string): string | null {
  const normalized = normalizeMint(value);
  if (!normalized) return 'Enter a token mint address.';
  if (!BASE58_MINT_PATTERN.test(normalized)) return 'Enter a valid Solana mint format.';
  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TokenInspectionApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function isAborted(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError');
}

export function useTokenAnalysis({ service = tokenInspectionApiService }: UseTokenAnalysisOptions = {}): TokenAnalysisController {
  const [mintInput, setMintInput] = useState('');
  const [deterministicStatus, setDeterministicStatus] = useState<TokenAnalysisDeterministicStatus>('idle');
  const [aiStatus, setAiStatus] = useState<TokenAnalysisAiStatus>('idle');
  const [report, setReport] = useState<TokenAnalysisReport | null>(null);
  const [coach, setCoach] = useState<TokenInspectionCoachResponse['coach']>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deterministicError, setDeterministicError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const coachControllerRef = useRef<AbortController | null>(null);
  const coachRequestInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      analysisControllerRef.current?.abort();
      coachControllerRef.current?.abort();
    };
  }, []);

  const clearInput = useCallback(() => {
    requestIdRef.current += 1;
    analysisControllerRef.current?.abort();
    coachControllerRef.current?.abort();
    analysisControllerRef.current = null;
    coachControllerRef.current = null;
    coachRequestInFlightRef.current = false;
    setMintInput('');
    setValidationError(null);
    setDeterministicError(null);
    setAiError(null);
    setAiStatus('idle');
    setCoach(null);
    setReport(null);
    setDeterministicStatus('idle');
  }, []);

  const analyzeToken = useCallback(async (mintOverride?: string) => {
    const normalizedMint = normalizeMint(mintOverride ?? mintInput);
    const nextValidationError = validateMintInput(normalizedMint);
    if (nextValidationError) {
      requestIdRef.current += 1;
      analysisControllerRef.current?.abort();
      coachControllerRef.current?.abort();
      analysisControllerRef.current = null;
      coachControllerRef.current = null;
      coachRequestInFlightRef.current = false;
      setValidationError(nextValidationError);
      setDeterministicError(null);
      setAiError(null);
      setAiStatus('idle');
      setCoach(null);
      setReport(null);
      setDeterministicStatus('error');
      return;
    }

    if (normalizedMint !== mintInput) {
      setMintInput(normalizedMint);
    }

    analysisControllerRef.current?.abort();
    coachControllerRef.current?.abort();
    analysisControllerRef.current = new AbortController();
    coachControllerRef.current = null;
    coachRequestInFlightRef.current = false;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = analysisControllerRef.current;
    const { signal } = controller;

    setValidationError(null);
    setDeterministicError(null);
    setAiError(null);
    setAiStatus('idle');
    setCoach(null);
    setReport(null);
    setDeterministicStatus('validating');

    const totalStartedAtMs = nowMs();
    let inspectionMs = 0;
    let provenanceMs = 0;

    try {
      setDeterministicStatus('loadingInspection');
      const inspectionStartedAtMs = nowMs();
      const inspection = await service.inspectToken({ mint: normalizedMint }, signal);
      inspectionMs = elapsedMs(inspectionStartedAtMs);
      if (requestId !== requestIdRef.current || signal.aborted) return;

      setDeterministicStatus('loadingProvenance');
      const provenanceStartedAtMs = nowMs();
      try {
        const provenance = await service.getProvenance(inspection.identity.mint, signal);
        provenanceMs = elapsedMs(provenanceStartedAtMs);
        if (requestId !== requestIdRef.current || signal.aborted) return;
        setReport({
          mint: inspection.identity.mint,
          inspection,
          provenance,
          provenanceWarning: null,
        });
      } catch (provenanceError) {
        provenanceMs = elapsedMs(provenanceStartedAtMs);
        if (isAborted(provenanceError, signal) || requestId !== requestIdRef.current) return;
        setReport({
          mint: inspection.identity.mint,
          inspection,
          provenance: null,
          provenanceWarning: getErrorMessage(
            provenanceError,
            'Identity provenance is temporarily unavailable. Inspection facts are still shown.',
          ),
        });
      }

      setDeterministicStatus('ready');
      console.info('[TrainRekt][TokenAnalysis][MobileFlowTiming] analyze-complete', {
        mint: normalizedMint,
        totalMs: elapsedMs(totalStartedAtMs),
        deterministicInspectionMs: inspectionMs,
        provenanceMs,
      });
    } catch (error) {
      if (isAborted(error, signal) || requestId !== requestIdRef.current) return;
      setReport(null);
      setDeterministicError(getErrorMessage(error, 'Token analysis failed. Please try again.'));
      setDeterministicStatus('error');
      console.info('[TrainRekt][TokenAnalysis][MobileFlowTiming] analyze-failed', {
        mint: normalizedMint,
        totalMs: elapsedMs(totalStartedAtMs),
        deterministicInspectionMs: inspectionMs,
        provenanceMs,
      });
    } finally {
      if (analysisControllerRef.current === controller) {
        analysisControllerRef.current = null;
      }
    }
  }, [mintInput, service]);

  const explainWithAi = useCallback(async () => {
    if (!report || aiStatus === 'loading' || coachRequestInFlightRef.current) return;

    coachRequestInFlightRef.current = true;
    const controller = new AbortController();
    coachControllerRef.current = controller;
    const requestId = requestIdRef.current;

    setAiStatus('loading');
    setAiError(null);

    try {
      const result = await service.getCoach(report.mint, controller.signal);
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      if (!result.available || !result.coach) {
        setCoach(null);
        setAiStatus('unavailable');
        setAiError('AI explanation is currently unavailable.');
        return;
      }

      setCoach(result.coach);
      setAiStatus('ready');
    } catch (error) {
      if (isAborted(error, controller.signal) || requestId !== requestIdRef.current) return;
      setCoach(null);
      setAiStatus('unavailable');
      setAiError(getErrorMessage(error, 'AI explanation is currently unavailable.'));
    } finally {
      if (coachControllerRef.current === controller) {
        coachControllerRef.current = null;
        coachRequestInFlightRef.current = false;
      }
    }
  }, [aiStatus, report, service]);

  return {
    mintInput,
    setMintInput,
    deterministicStatus,
    aiStatus,
    report,
    coach,
    validationError,
    deterministicError,
    aiError,
    analyzeToken,
    explainWithAi,
    clearInput,
  };
}
