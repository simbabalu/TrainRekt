import { describe, expect, it, vi } from 'vitest';

import type { BufferGlobalScope } from '@/polyfills';
import { ensureBufferGlobal } from '@/polyfills';

declare const __dirname: string;
declare function require(moduleName: string): {
  readFileSync?: (filePath: string, encoding: string) => string;
  resolve?: (...paths: string[]) => string;
};

const fs = require('fs');
const path = require('path');

describe('buffer polyfill', () => {
  it('initializes Buffer when missing', async () => {
    const { Buffer } = await import('buffer');
    const scope: BufferGlobalScope = {};

    ensureBufferGlobal(scope);

    expect(scope.Buffer).toBe(Buffer);
  });

  it('does not overwrite an existing Buffer implementation', async () => {
    const existingBuffer = class ExistingBuffer {} as unknown as typeof import('buffer').Buffer;
    const scope: BufferGlobalScope = { Buffer: existingBuffer };

    ensureBufferGlobal(scope);

    expect(scope.Buffer).toBe(existingBuffer);
  });

  it('can import wallet inspection service after polyfill initialization', async () => {
    const globalScope = globalThis as BufferGlobalScope;
    const originalBuffer = globalScope.Buffer;

    try {
      delete globalScope.Buffer;
      vi.resetModules();

      await import('@/polyfills');
      const serviceModule = await import('@/services/solana/walletInspectionService.impl');

      expect(globalScope.Buffer).toBeDefined();
      expect(serviceModule.walletInspectionServiceImpl).toBeDefined();
    } finally {
      if (typeof originalBuffer === 'undefined') {
        delete globalScope.Buffer;
      } else {
        globalScope.Buffer = originalBuffer;
      }
    }
  });

  it('does not require service-local global Buffer mutation', async () => {
    if (typeof fs.readFileSync !== 'function' || typeof path.resolve !== 'function') {
      throw new Error('Node file system helpers are unavailable in this test runtime.');
    }

    const serviceFilePath = path.resolve(__dirname, '../services/solana/walletInspectionService.impl.ts');
    const source = fs.readFileSync(serviceFilePath, 'utf8');

    expect(source.includes('globalThis.Buffer')).toBe(false);
    expect(source.includes('global.Buffer')).toBe(false);
  });
});