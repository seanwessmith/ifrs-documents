import type { Span, Config, ExtractionResult } from '@ifrs/core';
import { ulid } from '@ifrs/core';
import { callClaude, parseJsonResponse } from './claude.js';
import { DefinitionExtractionResponseSchema, type DefinitionDraft } from './schemas.js';
import { DEFINITION_EXTRACTOR_SYSTEM_PROMPT, buildContextPrompt } from './prompts.js';

export async function extractDefinitions(
  spans: Span[],
  config: Config,
  windowSize: number = 6
): Promise<ExtractionResult<DefinitionDraft & { id: string; documentId: string }>> {
  const windows = createDefinitionWindows(spans, windowSize);
  const results: (DefinitionDraft & { id: string; documentId: string })[] = [];
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
        DEFINITION_EXTRACTOR_SYSTEM_PROMPT,
        contextPrompt,
        config.claude.apiKey
      );

      const definitions = parseJsonResponse<DefinitionDraft>(
        response.content,
        DefinitionExtractionResponseSchema
      );

      totalTokens += response.usage?.total_tokens || 0;

      const validDefinitions = definitions
        .filter(def => def.confidence >= config.confidence.definitions)
        .map(def => ({
          ...def,
          id: ulid(),
          documentId: spans[0].documentId,
        }));

      results.push(...validDefinitions);

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

function createDefinitionWindows(spans: Span[], windowSize: number): Span[][] {
  const windows: Span[][] = [];
  
  const definitionCandidates = spans.filter(span => {
    const text = span.text.toLowerCase();
    
    return (
      text.includes(' is ') ||
      text.includes(' are ') ||
      text.includes(' means ') ||
      text.includes(' refers to ') ||
      text.includes(' defined as ') ||
      span.role === 'heading'
    );
  });

  if (definitionCandidates.length === 0) {
    for (let i = 0; i < spans.length; i += windowSize) {
      windows.push(spans.slice(i, i + windowSize));
    }
    return windows;
  }

  for (const candidate of definitionCandidates) {
    const candidateIdx = spans.indexOf(candidate);
    const startIdx = Math.max(0, candidateIdx - 1);
    const endIdx = Math.min(spans.length, candidateIdx + windowSize - 1);
    
    const window = spans.slice(startIdx, endIdx);
    windows.push(window);
  }

  return windows;
}