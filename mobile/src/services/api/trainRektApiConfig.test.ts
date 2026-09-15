import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTrainRektApiConfig } from './trainRektApiConfig';

describe('getTrainRektApiConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads EXPO_PUBLIC_TRAINREKT_API_BASE_URL from runtime env when no override is provided', () => {
    vi.stubEnv('EXPO_PUBLIC_TRAINREKT_API_BASE_URL', 'https://runtime.example.com/');

    const config = getTrainRektApiConfig();
    expect(config.baseUrl).toBe('https://runtime.example.com');
  });

  it('uses EXPO_PUBLIC_TRAINREKT_API_BASE_URL when provided', () => {
    const config = getTrainRektApiConfig({ EXPO_PUBLIC_TRAINREKT_API_BASE_URL: 'https://api.example.com/' });
    expect(config.baseUrl).toBe('https://api.example.com');
  });

  it('returns null when base URL is missing', () => {
    const config = getTrainRektApiConfig({ EXPO_PUBLIC_TRAINREKT_API_BASE_URL: undefined });
    expect(config.baseUrl).toBeNull();
  });
});
