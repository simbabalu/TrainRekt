import { Buffer as NodeBuffer } from 'buffer';

export type BufferGlobalScope = {
  Buffer?: typeof NodeBuffer;
};

export function ensureBufferGlobal(scope: BufferGlobalScope = globalThis as BufferGlobalScope): void {
  if (typeof scope.Buffer === 'undefined') {
    scope.Buffer = NodeBuffer;
  }
}

ensureBufferGlobal();
