const encoder = new TextEncoder();

export interface TrainingSigningMessage {
  nonce: string;
  displayMessage: string;
  messageBytes: Uint8Array;
}

export function buildTrainingSigningMessageText(nonce: string): string {
  return [
    'TrainRekt Wallet Safety Training',
    '',
    'I am signing this message only to learn how Solana message signatures work.',
    '',
    'This message does not authorize:',
    '- a token transfer',
    '- a transaction',
    '- spending authority',
    '- account ownership changes',
    '',
    `Training nonce: ${nonce}`,
  ].join('\n');
}

export function encodeUtf8Message(message: string): Uint8Array {
  return encoder.encode(message);
}

export function buildTrainingSigningMessage(nonce: string): TrainingSigningMessage {
  const displayMessage = buildTrainingSigningMessageText(nonce);
  return {
    nonce,
    displayMessage,
    messageBytes: encodeUtf8Message(displayMessage),
  };
}

export function createTrainingSigningNonce(randomBytes: Uint8Array): string {
  return Array.from(randomBytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function createRandomTrainingSigningNonce(
  randomValueSource: (buffer: Uint8Array) => void = (buffer) => {
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(buffer as unknown as Uint8Array<ArrayBuffer>);
      return;
    }
    for (let index = 0; index < buffer.length; index += 1) {
      buffer[index] = Math.floor(Math.random() * 256);
    }
  },
): string {
  const bytes = new Uint8Array(12);
  randomValueSource(bytes);
  return createTrainingSigningNonce(bytes);
}
