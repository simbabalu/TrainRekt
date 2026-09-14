import {
  TokenIdentityProvenanceResponse,
  TokenInspectionApiError,
  TokenInspectionApiRequest,
  TokenInspectionCoachResponse,
  TokenInspectionResponse,
} from '@/types/tokenAnalysis';
import { getTrainRektApiConfig } from '@/services/api/trainRektApiConfig';

interface ProblemDetailsLike {
  title?: unknown;
  detail?: unknown;
  status?: unknown;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function elapsedMs(startedAtMs: number): number {
  return Math.max(0, Math.round(nowMs() - startedAtMs));
}

function tryExtractMintFromBody(body: unknown): string | null {
  if (!isObjectRecord(body)) return null;
  const mint = body.mint;
  if (typeof mint !== 'string') return null;
  const trimmed = mint.trim();
  return trimmed || null;
}

function safeMintFromPath(path: string): string | null {
  const match = /^\/api\/token-inspections\/([^/]+)\/(?:provenance|coach)$/u.exec(path);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    return decoded.trim() || null;
  } catch {
    return null;
  }
}

export interface TokenInspectionApiService {
  inspectToken: (request: TokenInspectionApiRequest, signal?: AbortSignal) => Promise<TokenInspectionResponse>;
  getProvenance: (mint: string, signal?: AbortSignal) => Promise<TokenIdentityProvenanceResponse>;
  getCoach: (mint: string, signal?: AbortSignal) => Promise<TokenInspectionCoachResponse>;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function parseJson<T>(value: unknown, context: string): T {
  if (!isObjectRecord(value)) {
    throw new TokenInspectionApiError('invalid-response', `${context} returned an invalid response.`);
  }

  return value as T;
}

function cleanMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseProblemDetails(body: unknown): ProblemDetailsLike {
  if (!isObjectRecord(body)) return {};
  return body;
}

function mapHttpError(status: number, body: unknown): TokenInspectionApiError {
  const problem = parseProblemDetails(body);
  const title = cleanMessage(problem.title, 'Request failed');
  const detail = cleanMessage(problem.detail, 'Token analysis request failed. Please try again.');

  if (status === 400) {
    return new TokenInspectionApiError('invalid-mint', detail);
  }

  if (status === 404) {
    return new TokenInspectionApiError('mint-not-found', detail);
  }

  if (status === 422) {
    return new TokenInspectionApiError('unsupported-token', detail);
  }

  if (status === 499) {
    return new TokenInspectionApiError('request-cancelled', detail);
  }

  if (status === 503) {
    if (/cache/i.test(title)) {
      return new TokenInspectionApiError('cache-unavailable', detail);
    }

    return new TokenInspectionApiError('provider-unavailable', detail);
  }

  if (status >= 500) {
    return new TokenInspectionApiError('backend-unavailable', detail);
  }

  return new TokenInspectionApiError('unknown', detail);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function postJson<T>(baseUrl: string, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const startedAtMs = nowMs();
  const mint = tryExtractMintFromBody(body) ?? safeMintFromPath(path);

  console.info('[TrainRekt][TokenAnalysis][MobileApiTiming] request-start', {
    path,
    mint,
  });

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    console.info('[TrainRekt][TokenAnalysis][MobileApiTiming] request-failed', {
      path,
      mint,
      elapsedMs: elapsedMs(startedAtMs),
      cancelled: error instanceof Error && error.name === 'AbortError',
    });

    if (error instanceof Error && error.name === 'AbortError') {
      throw new TokenInspectionApiError('request-cancelled', 'Analysis request was cancelled.');
    }

    throw new TokenInspectionApiError('backend-unavailable', 'Token analysis is currently unavailable. Please try again.');
  }

  const parsedBody = await readResponseBody(response);
  if (!response.ok) {
    console.info('[TrainRekt][TokenAnalysis][MobileApiTiming] request-error-response', {
      path,
      mint,
      elapsedMs: elapsedMs(startedAtMs),
      status: response.status,
    });
    throw mapHttpError(response.status, parsedBody);
  }

  console.info('[TrainRekt][TokenAnalysis][MobileApiTiming] request-success', {
    path,
    mint,
    elapsedMs: elapsedMs(startedAtMs),
    status: response.status,
  });

  return parseJson<T>(parsedBody, path);
}

export class HttpTokenInspectionApiService implements TokenInspectionApiService {
  private readonly baseUrl: string | null;

  constructor(options?: { baseUrl?: string | null }) {
    const config = getTrainRektApiConfig();
    this.baseUrl = options?.baseUrl ?? config.baseUrl;
  }

  private get requiredBaseUrl(): string {
    if (this.baseUrl) return this.baseUrl;
    throw new TokenInspectionApiError(
      'backend-unavailable',
      'Token analysis API base URL is not configured. Set EXPO_PUBLIC_TRAINREKT_API_BASE_URL.',
    );
  }

  async inspectToken(request: TokenInspectionApiRequest, signal?: AbortSignal): Promise<TokenInspectionResponse> {
    return await postJson<TokenInspectionResponse>(this.requiredBaseUrl, '/api/token-inspections', request, signal);
  }

  async getProvenance(mint: string, signal?: AbortSignal): Promise<TokenIdentityProvenanceResponse> {
    return await postJson<TokenIdentityProvenanceResponse>(this.requiredBaseUrl, `/api/token-inspections/${encodeURIComponent(mint)}/provenance`, {}, signal);
  }

  async getCoach(mint: string, signal?: AbortSignal): Promise<TokenInspectionCoachResponse> {
    return await postJson<TokenInspectionCoachResponse>(this.requiredBaseUrl, `/api/token-inspections/${encodeURIComponent(mint)}/coach`, {}, signal);
  }
}

export const tokenInspectionApiService: TokenInspectionApiService = new HttpTokenInspectionApiService();
