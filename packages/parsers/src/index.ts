import type { ParsedBlock, DocumentType } from '../../core/src/index.ts';

export interface DocumentParseResult {
  spans: ParsedBlock[];
  pageCount?: number;
}

export async function parseDocument(buffer: Buffer, type: DocumentType): Promise<DocumentParseResult> {
  switch (type) {
    case 'pdf': {
      const { parsePDF } = await import('./pdf.js');
      return await parsePDF(buffer);
    }
    case 'epub': {
      const { parseEPUB } = await import('./epub.js');
      return await parseEPUB(buffer);
    }
    case 'html':
      throw new Error('HTML parsing not yet implemented');
    case 'md':
      throw new Error('Markdown parsing not yet implemented');
    case 'txt':
      throw new Error('Text parsing not yet implemented');
    default:
      throw new Error(`Unsupported document type: ${type}`);
  }
}

// Export functions for direct use (lazy loaded)
export const parsePDF = async (buffer: Buffer) => {
  const { parsePDF } = await import('./pdf.js');
  return parsePDF(buffer);
};

export const parseEPUB = async (buffer: Buffer) => {
  const { parseEPUB } = await import('./epub.js');
  return parseEPUB(buffer);
};