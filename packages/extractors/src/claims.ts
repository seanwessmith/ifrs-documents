import type { Span, Config, ExtractionResult } from '@ifrs/core';
import { ulid } from '@ifrs/core';
import { callClaude, parseJsonResponse } from './claude.js';
import { ClaimExtractionResponseSchema, type ClaimDraft } from './schemas.js';
import { CLAIM_EXTRACTOR_SYSTEM_PROMPT, buildContextPrompt } from './prompts.js';

export async function extractClaims(
  spans: Span[],
  config: Config,
  windowSize: number = 8
): Promise<ExtractionResult<ClaimDraft & { id: string; documentId: string }>> {
  const windows = createClaimWindows(spans, windowSize);
  const results: (ClaimDraft & { id: string; documentId: string })[] = [];
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
        CLAIM_EXTRACTOR_SYSTEM_PROMPT,
        contextPrompt,
        config.claude.apiKey
      );

      const claims = parseJsonResponse<ClaimDraft>(
        response.content,
        ClaimExtractionResponseSchema
      );

      totalTokens += response.usage?.total_tokens || 0;

      const validClaims = claims
        .filter(claim => claim.confidence >= config.confidence.claims)
        .map(claim => ({
          ...claim,
          id: ulid(),
          documentId: spans[0].documentId,
        }));

      results.push(...validClaims);

      await new Promise(resolve => setTimeout(resolve, 1000));

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

function createClaimWindows(spans: Span[], windowSize: number): Span[][] {
  const windows: Span[][] = [];
  
  const factualSpans = spans.filter(span => 
    span.role === 'para' || span.role === 'list'
  );

  for (let i = 0; i < factualSpans.length; i += Math.floor(windowSize * 0.7)) {
    const window = factualSpans.slice(i, i + windowSize);
    if (window.length > 0) {
      windows.push(window);
    }
  }

  return windows;
}