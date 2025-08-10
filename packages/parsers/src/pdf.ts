import { ulid, hashSpan, normalizeWhitespace } from '@ifrs/core';
import type { ParsedBlock, SpanRole } from '@ifrs/core';

interface PDFParseResult {
  spans: ParsedBlock[];
  pageCount: number;
}

export async function parsePDF(buffer: Buffer | Uint8Array): Promise<PDFParseResult> {
  // Dynamic import to avoid loading pdf-parse unless needed
  const pdfParse = (await import('pdf-parse')).default;
  const data = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  const pdfData = await pdfParse(data);
  
  const text = normalizeWhitespace(pdfData.text);
  const spans = extractSpansFromText(text, pdfData.numpages);
  
  return {
    spans: mergeParagraphs(spans),
    pageCount: pdfData.numpages,
  };
}

function extractSpansFromText(text: string, pageCount: number): ParsedBlock[] {
  const spans: ParsedBlock[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  let currentOffset = 0;
  const linesPerPage = Math.ceil(lines.length / pageCount);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const pageNum = Math.floor(i / linesPerPage) + 1;
    const role = classifyTextRole(trimmedLine);
    
    spans.push({
      id: ulid(),
      role,
      text: trimmedLine,
      page: pageNum,
      start: currentOffset,
      end: currentOffset + trimmedLine.length,
    });
    
    currentOffset += line.length + 1; // +1 for newline
  }
  
  return spans;
}

function classifyTextRole(text: string): SpanRole {
  if (text.length < 5) return 'para';
  
  if (isHeading(text)) return 'heading';
  if (isList(text)) return 'list';
  if (isCode(text)) return 'code';
  if (isQuote(text)) return 'quote';
  if (isTable(text)) return 'table';
  if (isCaption(text)) return 'caption';
  if (isFigure(text)) return 'figure';
  
  return 'para';
}

function isHeading(text: string): boolean {
  if (text.length > 200) return false;
  
  const headingPatterns = [
    /^\d+\.?\s+[A-Z]/,           
    /^[A-Z][A-Z\s]{5,}$/,        
    /^\d+\.\d+\.?\s+/,           
    /^Chapter\s+\d+/i,           
    /^Section\s+\d+/i,           
    /^[A-Z][^.!?]*[^.!?]$/,      
  ];
  
  return headingPatterns.some(pattern => pattern.test(text));
}

function isList(text: string): boolean {
  const listPatterns = [
    /^\s*[-•*]\s+/,
    /^\s*\d+\.\s+/,
    /^\s*\([a-z]\)\s+/,
    /^\s*[a-z]\)\s+/,
  ];
  
  return listPatterns.some(pattern => pattern.test(text));
}

function isCode(text: string): boolean {
  const codeIndicators = [
    /^\s*(function|class|def|var|let|const|import|export)/,
    /[{}();].*[{}();]/,
    /^\s*[A-Za-z_$][A-Za-z0-9_$]*\s*[:=]/,
  ];
  
  return codeIndicators.some(pattern => pattern.test(text));
}

function isQuote(text: string): boolean {
  return text.startsWith('"') || text.startsWith('"') || text.includes('"');
}

function isTable(text: string): boolean {
  const tabSeparated = text.split('\t').length > 2;
  const pipeSeparated = text.split('|').length > 2;
  const hasMultipleSpaces = /\s{3,}/.test(text) && text.split(/\s{3,}/).length > 2;
  
  return tabSeparated || pipeSeparated || hasMultipleSpaces;
}

function isCaption(text: string): boolean {
  const captionPatterns = [
    /^(Figure|Table|Chart|Diagram)\s+\d+/i,
    /^Caption:/i,
  ];
  
  return captionPatterns.some(pattern => pattern.test(text));
}

function isFigure(text: string): boolean {
  return text.includes('Figure') && text.length < 100;
}

function mergeParagraphs(spans: ParsedBlock[]): ParsedBlock[] {
  const merged: ParsedBlock[] = [];
  let current: ParsedBlock | null = null;
  
  for (const span of spans) {
    if (span.role === 'para' && current?.role === 'para' && 
        span.page === current.page && 
        span.start - current.end < 50) {
      
      current.text += ' ' + span.text;
      current.end = span.end;
    } else {
      if (current) merged.push(current);
      current = { ...span };
    }
  }
  
  if (current) merged.push(current);
  
  return merged.map(span => ({
    ...span,
    checksum: hashSpan(span.text, span.start, span.end),
  }));
}