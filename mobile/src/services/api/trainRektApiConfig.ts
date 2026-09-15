export interface TrainRektApiConfig {
  baseUrl: string | null;
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function getTrainRektApiConfig(env: Record<string, string | undefined> = process.env): TrainRektApiConfig {
  const runtimeBaseUrl = process.env.EXPO_PUBLIC_TRAINREKT_API_BASE_URL;
  const baseUrl = env === process.env
    ? runtimeBaseUrl
    : env.EXPO_PUBLIC_TRAINREKT_API_BASE_URL;

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
  };
}
