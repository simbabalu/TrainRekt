import { describe, expect, it } from 'vitest';

declare const __dirname: string;
declare function require(moduleName: string): {
  readFileSync?: (filePath: string, encoding: string) => string;
  resolve?: (...paths: string[]) => string;
};

const fs = require('fs');
const path = require('path');

describe('entrypoint config', () => {
  it('uses index.js as package main entrypoint', () => {
    if (typeof fs.readFileSync !== 'function' || typeof path.resolve !== 'function') {
      throw new Error('Node file system helpers are unavailable in this test runtime.');
    }

    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJsonRaw = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonRaw) as { main?: unknown };

    expect(packageJson.main).toBe('index.js');
  });
});
