import type { Span, Config, ExtractionResult } from '../../core/src/index.ts';
import { ulid } from '../../core/src/index.ts';
import { callClaude, parseJsonResponse } from './claude.js';
import { FunctionExtractionResponseSchema, type FunctionDocDraft } from './schemas.js';
import { FUNCTION_EXTRACTOR_SYSTEM_PROMPT, buildContextPrompt } from './prompts.js';

export async function extractFunctions(
  spans: Span[],
  config: Config,
  windowSize: number = 5
): Promise<ExtractionResult<FunctionDocDraft & { id: string; documentId: string }>> {
  const windows = createExtractionWindows(spans, windowSize);
  const results: (FunctionDocDraft & { id: string; documentId: string })[] = [];
  const errors: string[] = [];
  let totalTokens = 0;

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    console.log(`  Processing window ${i + 1}/${windows.length} (${window.length} spans)`);
    
    try {
      const contextPrompt = buildContextPrompt(window.map(span => ({
        id: span.id,
        role: span.role,
        page: span.page,
        text: span.text
      })));

      const response = await callClaude(
        FUNCTION_EXTRACTOR_SYSTEM_PROMPT,
        contextPrompt,
        config.claude.apiKey
      );

      const functions = parseJsonResponse<FunctionDocDraft>(
        response.content,
        FunctionExtractionResponseSchema
      );

      totalTokens += response.usage?.total_tokens || 0;

      const validFunctions = functions
        .filter(func => func.confidence >= config.confidence.functions)
        .map(func => ({
          ...func,
          id: ulid(),
          documentId: spans[0].documentId,
        }));

      results.push(...validFunctions);

      // Rate limiting: 2s base delay to avoid hitting limits
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

    } catch (error) {
      const errorMsg = `Window ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.warn(`    ${errorMsg}`);
    }
  }

  return {
    units: results,
    errors,
    tokenCount: totalTokens,
  };
}

function createExtractionWindows(spans: Span[], windowSize: number): Span[][] {
  const windows: Span[][] = [];
  const headings = spans.filter(span => span.role === 'heading');
  
  if (headings.length === 0) {
    for (let i = 0; i < spans.length; i += windowSize) {
      windows.push(spans.slice(i, i + windowSize));
    }
    return windows;
  }

  for (let i = 0; i < headings.length; i++) {
    const currentHeading = headings[i];
    const nextHeading = headings[i + 1];
    
    const startIdx = spans.indexOf(currentHeading);
    const endIdx = nextHeading ? spans.indexOf(nextHeading) : spans.length;
    
    const sectionSpans = spans.slice(startIdx, endIdx);
    
    if (sectionSpans.length <= windowSize) {
      windows.push(sectionSpans);
    } else {
      for (let j = 0; j < sectionSpans.length; j += Math.floor(windowSize * 0.8)) {
        const window = sectionSpans.slice(j, j + windowSize);
        if (window.length > 0) {
          windows.push(window);
        }
      }
    }
  }

  return windows;
}