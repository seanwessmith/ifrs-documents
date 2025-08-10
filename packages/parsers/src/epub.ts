// Use require to avoid bundling issues with epub2
const epub2 = require('epub2');
const EPub = epub2.EPub || epub2.default || epub2;
import { ulid, hashSpan, normalizeWhitespace } from '@ifrs/core';
import type { ParsedBlock, SpanRole } from '@ifrs/core';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface EPubParseResult {
  spans: ParsedBlock[];
  pageCount: number;
}

export async function parseEPUB(buffer: Buffer | Uint8Array): Promise<EPubParseResult> {
  const data = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  
  // Write buffer to temporary file since epub2 requires file path
  const tempPath = join(tmpdir(), `epub-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.epub`);
  writeFileSync(tempPath, data);
  
  try {
    return new Promise((resolve, reject) => {
      const epub = new EPub(tempPath);
      
      epub.on('error', reject);
      
      epub.on('end', async () => {
      try {
        const spans: ParsedBlock[] = [];
        let globalOffset = 0;
        let pageNum = 1;
        
        // Get all chapters
        const chapters = epub.flow || [];
        
        for (const chapter of chapters) {
          try {
            const chapterText = await getChapterText(epub, chapter.id);
            if (chapterText) {
              const cleanText = normalizeWhitespace(chapterText);
              const chapterSpans = extractSpansFromText(cleanText, pageNum, globalOffset);
              spans.push(...chapterSpans);
              globalOffset += cleanText.length + 1;
              pageNum++;
            }
          } catch (error) {
            console.warn(`Error parsing chapter ${chapter.id}:`, error);
          }
        }
        
          resolve({
            spans: mergeParagraphs(spans),
            pageCount: pageNum - 1,
          });
        } catch (error) {
          reject(error);
        }
      });
      
      epub.parse();
    });
  } finally {
    // Clean up temporary file
    try {
      unlinkSync(tempPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

function getChapterText(epub: any, chapterId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    epub.getChapter(chapterId, (error: any, text: string) => {
      if (error) {
        reject(error);
      } else {
        // Strip HTML tags from the text
        const cleanText = text
          .replace(/<[^>]*>/g, ' ')
          .replace(/&[a-zA-Z0-9#]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        resolve(cleanText);
      }
    });
  });
}

function extractSpansFromText(text: string, pageNum: number, globalOffset: number): ParsedBlock[] {
  const spans: ParsedBlock[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  let currentOffset = globalOffset;
  
  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara || trimmedPara.length < 10) continue;
    
    const role = classifyTextRole(trimmedPara);
    
    spans.push({
      id: ulid(),
      role,
      text: trimmedPara,
      page: pageNum,
      start: currentOffset,
      end: currentOffset + trimmedPara.length,
    });
    
    currentOffset += trimmedPara.length + 2; // +2 for paragraph break
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
    /^(Chapter|Section|Part)\s+\d+/i,
    /^[A-Z][A-Z\s]{5,}$/,
    /^\d+\.?\s+[A-Z]/,
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