import { describe, expect, it } from 'vitest';

import { getTrainRektApiConfig } from './trainRektApiConfig';

describe('getTrainRektApiConfig', () => {
  it('uses EXPO_PUBLIC_TRAINREKT_API_BASE_URL when provided', () => {
    const config = getTrainRektApiConfig({ EXPO_PUBLIC_TRAINREKT_API_BASE_URL: 'https://api.example.com/' });
    expect(config.baseUrl).toBe('https://api.example.com');
  });

  it('returns null when base URL is missing', () => {
    const config = getTrainRektApiConfig({ EXPO_PUBLIC_TRAINREKT_API_BASE_URL: undefined });
    expect(config.baseUrl).toBeNull();
  });
});
