import type { Span, Config, ExtractionResult, Definition } from '../../core/src/index.ts';
import { ulid } from '../../core/src/index.ts';
import { callClaude, parseJsonResponse } from './claude.js';
import { DefinitionExtractionResponseSchema, type DefinitionDraft } from './schemas.js';
import { DEFINITION_EXTRACTOR_SYSTEM_PROMPT, buildContextPrompt } from './prompts.js';
import { createHash } from 'crypto';

export async function extractDefinitions(
  spans: Span[],
  config: Config,
  windowSize: number = 6
): Promise<ExtractionResult<Definition>> {
  const windows = createDefinitionWindows(spans, windowSize);
  const results: Definition[] = [];
  const errors: string[] = [];
  let totalTokens = 0;
  const seenDefinitions = new Set<string>();

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
        .filter(def => {
          // Quality gates
          if (def.confidence < config.confidence.definitions) return false;
          if (!def.span_ids || def.span_ids.length < 1 || def.span_ids.length > 3) return false;
          if (def.definition.length > 400) return false;
          
          // Deduplication check
          const termSlug = createTermSlug(def.term);
          const dedupKey = `${spans[0].documentId}:${termSlug}`;
          if (seenDefinitions.has(dedupKey)) return false;
          
          seenDefinitions.add(dedupKey);
          return true;
        })
        .map(def => enrichDefinition(def, spans[0].documentId));

      results.push(...validDefinitions);
      
      console.log(`    Extracted ${validDefinitions.length} valid definitions (${definitions.length - validDefinitions.length} filtered out)`);

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

function createTermSlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens and spaces
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .trim();
}

function normalizeAliases(aliases: string[]): string[] {
  return aliases.map(alias => 
    alias.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
  );
}

function enrichDefinition(def: DefinitionDraft, documentId: string): Definition {
  const termSlug = createTermSlug(def.term);
  const aliasesNorm = normalizeAliases(def.aliases);
  
  // Auto-tag finance definitions
  const tags = def.tags || [];
  const defText = def.definition.toLowerCase();
  const termText = def.term.toLowerCase();
  
  if (termText.includes('profit') || termText.includes('margin') || 
      termText.includes('ratio') || termText.includes('return') ||
      defText.includes('profit') || defText.includes('revenue') || 
      defText.includes('income') || defText.includes('asset')) {
    if (!tags.includes('financial-metrics')) {
      tags.push('financial-metrics');
    }
  }
  
  if (termText.includes('margin') || termText.includes('profitability') ||
      defText.includes('profitability') || defText.includes('profitable')) {
    if (!tags.includes('profitability')) {
      tags.push('profitability');
    }
  }

  return {
    ...def,
    id: ulid(),
    documentId,
    term_slug: termSlug,
    aliases_norm: aliasesNorm,
    tags,
  };
}