import { describe, expect, it } from 'vitest';

declare const __dirname: string;
declare function require(moduleName: string): {
  readFileSync?: (filePath: string, encoding: string) => string;
  resolve?: (...paths: string[]) => string;
};

const fs = require('fs');
const path = require('path');

describe('bootstrap entry', () => {
  it('loads random-values polyfill before expo-router entry', () => {
    if (typeof fs.readFileSync !== 'function' || typeof path.resolve !== 'function') {
      throw new Error('Node file system helpers are unavailable in this test runtime.');
    }

    const entryFilePath = path.resolve(__dirname, '../../index.js');
    const entryFile = fs.readFileSync(entryFilePath, 'utf8');

    const polyfillRequireIndex = entryFile.indexOf("require('react-native-get-random-values')");
    const bufferPolyfillRequireIndex = entryFile.indexOf("require('./src/polyfills')");
    const routerRequireIndex = entryFile.indexOf("require('expo-router/entry')");

    expect(polyfillRequireIndex).toBeGreaterThanOrEqual(0);
    expect(bufferPolyfillRequireIndex).toBeGreaterThanOrEqual(0);
    expect(routerRequireIndex).toBeGreaterThanOrEqual(0);
    expect(polyfillRequireIndex).toBeLessThan(routerRequireIndex);
    expect(bufferPolyfillRequireIndex).toBeLessThan(routerRequireIndex);
  });
});
