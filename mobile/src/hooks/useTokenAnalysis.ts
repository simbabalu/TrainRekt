import { useCallback, useRef, useState } from 'react';

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
  analyzeToken: () => Promise<void>;
  explainWithAi: () => Promise<void>;
  clearInput: () => void;
}

const BASE58_MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

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
  const coachRequestInFlightRef = useRef(false);

  const clearInput = useCallback(() => {
    setMintInput('');
    setValidationError(null);
    setDeterministicError(null);
    setAiError(null);
    setAiStatus('idle');
    setCoach(null);
    setReport(null);
    setDeterministicStatus('idle');
  }, []);

  const analyzeToken = useCallback(async () => {
    const normalizedMint = normalizeMint(mintInput);
    const nextValidationError = validateMintInput(normalizedMint);
    if (nextValidationError) {
      setValidationError(nextValidationError);
      setDeterministicError(null);
      setAiError(null);
      setAiStatus('idle');
      setCoach(null);
      setReport(null);
      setDeterministicStatus('error');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setValidationError(null);
    setDeterministicError(null);
    setAiError(null);
    setAiStatus('idle');
    setCoach(null);
    setDeterministicStatus('validating');

    try {
      setDeterministicStatus('loadingInspection');
      const inspection = await service.inspectToken({ mint: normalizedMint });
      if (requestId !== requestIdRef.current) return;

      setDeterministicStatus('loadingProvenance');
      try {
        const provenance = await service.getProvenance(inspection.identity.mint);
        if (requestId !== requestIdRef.current) return;
        setReport({
          mint: inspection.identity.mint,
          inspection,
          provenance,
          provenanceWarning: null,
        });
      } catch (provenanceError) {
        if (requestId !== requestIdRef.current) return;
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
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setReport(null);
      setDeterministicError(getErrorMessage(error, 'Token analysis failed. Please try again.'));
      setDeterministicStatus('error');
    }
  }, [mintInput, service]);

  const explainWithAi = useCallback(async () => {
    if (!report || aiStatus === 'loading' || coachRequestInFlightRef.current) return;

    coachRequestInFlightRef.current = true;

    setAiStatus('loading');
    setAiError(null);

    try {
      const result = await service.getCoach(report.mint);
      if (!result.available || !result.coach) {
        setCoach(null);
        setAiStatus('unavailable');
        setAiError('AI explanation is currently unavailable.');
        return;
      }

      setCoach(result.coach);
      setAiStatus('ready');
    } catch (error) {
      setCoach(null);
      setAiStatus('unavailable');
      setAiError(getErrorMessage(error, 'AI explanation is currently unavailable.'));
    } finally {
      coachRequestInFlightRef.current = false;
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
