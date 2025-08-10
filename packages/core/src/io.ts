import { readFileSync } from 'fs';

export async function readFileOrUrl(pathOrUrl: string): Promise<Buffer> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const response = await fetch(pathOrUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${pathOrUrl}: ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } else {
    return readFileSync(pathOrUrl);
  }
}

export function chunkText(text: string, maxChars: number, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    let chunkEnd = end;
    
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastSpace, lastNewline);
      
      if (breakPoint > start + maxChars * 0.8) {
        chunkEnd = breakPoint;
      }
    }
    
    chunks.push(text.slice(start, chunkEnd));
    start = Math.max(chunkEnd - overlap, start + 1);
    
    if (start >= text.length) break;
  }
  
  return chunks;
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}