import { createHash, randomBytes } from 'crypto';

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function ulid(): string {
  const timestamp = Date.now();
  const randomness = randomBytes(10);
  
  const timestampBytes = Buffer.allocUnsafe(6);
  timestampBytes.writeUIntBE(timestamp, 0, 6);
  
  const bytes = Buffer.concat([timestampBytes, randomness]);
  return bytes.toString('base64url').toUpperCase();
}

export function hashSpan(text: string, start: number, end: number): string {
  return sha256(`${text}:${start}:${end}`);
}

export function hashDocument(content: Buffer): string {
  return sha256(content);
}