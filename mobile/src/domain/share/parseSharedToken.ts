export type ParseSharedTokenResult =
  | { kind: 'single'; mint: string }
  | { kind: 'none' }
  | { kind: 'multiple'; mints: string[] };

export interface ParseSharedTokenInput {
  text?: string | null;
  webUrl?: string | null;
  title?: string | null;
}

const MAX_SHARED_TEXT_LENGTH = 12_000;
const BASE58_MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const BASE58_CANDIDATE_GLOBAL = /(^|[^1-9A-HJ-NP-Za-km-z])([1-9A-HJ-NP-Za-km-z]{32,64})(?=$|[^1-9A-HJ-NP-Za-km-z])/g;
const URL_CANDIDATE_GLOBAL = /https?:\/\/[^\s<>'"\])]+/gi;
const PUMP_FUN_HOSTS = new Set(['pump.fun', 'www.pump.fun']);
const QUERY_KEYS = ['mint', 'token', 'address', 'ca'] as const;

function toSafeText(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.slice(0, MAX_SHARED_TEXT_LENGTH);
}

function tryDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeUrlCandidate(value: string): string {
  return value.replace(/[.,;:!?]+$/u, '');
}

function isMintCandidate(value: string): boolean {
  return BASE58_MINT_PATTERN.test(value);
}

function addCandidate(target: Set<string>, value: string): void {
  const candidate = value.trim();
  if (!isMintCandidate(candidate)) return;
  target.add(candidate);
}

function collectCandidatesFromUrl(url: URL, target: Set<string>): void {
  const segments = url.pathname.split('/').map((segment) => tryDecodeUriComponent(segment)).filter(Boolean);
  for (const segment of segments) {
    addCandidate(target, segment);
  }

  for (const key of QUERY_KEYS) {
    for (const value of url.searchParams.getAll(key)) {
      addCandidate(target, tryDecodeUriComponent(value));
    }
  }

  // pump.fun commonly embeds contract addresses in path segments.
  if (PUMP_FUN_HOSTS.has(url.hostname.toLowerCase())) {
    for (const segment of segments) {
      addCandidate(target, segment);
    }
  }
}

function collectCandidatesFromText(text: string, target: Set<string>): void {
  if (!text) return;

  for (const match of text.matchAll(BASE58_CANDIDATE_GLOBAL)) {
    const candidate = match[2];
    if (!candidate) continue;
    addCandidate(target, candidate);
  }

  for (const match of text.matchAll(URL_CANDIDATE_GLOBAL)) {
    const rawUrl = match[0];
    if (!rawUrl) continue;
    const normalized = normalizeUrlCandidate(rawUrl);
    try {
      collectCandidatesFromUrl(new URL(normalized), target);
    } catch {
      continue;
    }
  }
}

export function parseSharedToken(input: ParseSharedTokenInput): ParseSharedTokenResult {
  const text = toSafeText(input.text);
  const webUrl = toSafeText(input.webUrl);
  const title = toSafeText(input.title);

  const combinedText = [title, text, webUrl].filter(Boolean).join('\n');
  const candidates = new Set<string>();

  if (webUrl) {
    try {
      collectCandidatesFromUrl(new URL(normalizeUrlCandidate(webUrl)), candidates);
    } catch {
      // Ignore malformed URL input and continue scanning text.
    }
  }

  collectCandidatesFromText(combinedText, candidates);

  const mints = [...candidates];
  if (mints.length === 0) return { kind: 'none' };
  if (mints.length === 1) return { kind: 'single', mint: mints[0] };
  return { kind: 'multiple', mints };
}

export const shareParserLimits = {
  maxSharedTextLength: MAX_SHARED_TEXT_LENGTH,
};
