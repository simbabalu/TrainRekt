export interface TrainRektApiConfig {
  baseUrl: string | null;
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function getTrainRektApiConfig(env: Record<string, string | undefined> = process.env): TrainRektApiConfig {
  return {
    baseUrl: normalizeBaseUrl(env.EXPO_PUBLIC_TRAINREKT_API_BASE_URL),
  };
}
