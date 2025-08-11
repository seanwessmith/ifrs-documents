import type { Span, Config, ExtractionResult, Formula } from '../../core/src/index.ts';
import { ulid } from '../../core/src/index.ts';
import { callClaude, parseJsonResponse } from './claude.js';
import { FormulaExtractionResponseSchema, type FormulaDraft } from './schemas.js';
import { FORMULA_EXTRACTOR_SYSTEM_PROMPT, buildContextPrompt } from './prompts.js';
import { createHash } from 'crypto';

export async function extractFormulas(
  spans: Span[],
  config: Config,
  windowSize: number = 6
): Promise<ExtractionResult<Formula>> {
  const windows = createFormulaWindows(spans, windowSize);
  const results: Formula[] = [];
  const errors: string[] = [];
  let totalTokens = 0;
  const seenFormulas = new Set<string>();

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
        FORMULA_EXTRACTOR_SYSTEM_PROMPT,
        contextPrompt,
        config.claude.apiKey
      );

      const formulas = parseJsonResponse<FormulaDraft>(
        response.content,
        FormulaExtractionResponseSchema
      );

      totalTokens += response.usage?.total_tokens || 0;

      const validFormulas = formulas
        .filter(formula => {
          // Quality gates
          if (formula.confidence < config.confidence.functions) return false;
          if (!formula.span_ids || formula.span_ids.length < 1 || formula.span_ids.length > 3) return false;
          
          // Deduplication check - use expression as key
          const formulaKey = `${spans[0].documentId}:${createExpressionHash(formula.expression)}`;
          if (seenFormulas.has(formulaKey)) return false;
          
          seenFormulas.add(formulaKey);
          return true;
        })
        .map(formula => enrichFormula(formula, spans[0].documentId));

      results.push(...validFormulas);
      
      console.log(`    Extracted ${validFormulas.length} valid formulas (${formulas.length - validFormulas.length} filtered out)`);

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

function createFormulaWindows(spans: Span[], windowSize: number): Span[][] {
  const windows: Span[][] = [];
  
  const formulaCandidates = spans.filter(span => {
    const text = span.text.toLowerCase();
    
    return (
      text.includes(' = ') ||
      text.includes(' equals ') ||
      text.includes(' calculated as ') ||
      text.includes(' formula ') ||
      text.includes(' ratio ') ||
      text.includes(' margin ') ||
      text.includes(' return ') ||
      text.includes('calculate') ||
      text.includes('compute')
    );
  });

  if (formulaCandidates.length === 0) {
    for (let i = 0; i < spans.length; i += windowSize) {
      windows.push(spans.slice(i, i + windowSize));
    }
    return windows;
  }

  for (const candidate of formulaCandidates) {
    const candidateIdx = spans.indexOf(candidate);
    const startIdx = Math.max(0, candidateIdx - 1);
    const endIdx = Math.min(spans.length, candidateIdx + windowSize - 1);
    
    const window = spans.slice(startIdx, endIdx);
    windows.push(window);
  }

  return windows;
}

function createExpressionHash(expression: string): string {
  return createHash('sha256')
    .update(expression.toLowerCase().replace(/\s+/g, ''))
    .digest('hex')
    .substring(0, 16);
}

function enrichFormula(formula: FormulaDraft, documentId: string): Formula {
  // Auto-tag financial formulas
  const tags = [...formula.tags];
  const nameText = formula.name.toLowerCase();
  const expressionText = formula.expression.toLowerCase();
  
  if (nameText.includes('profit') || nameText.includes('margin') || 
      nameText.includes('ratio') || nameText.includes('return') ||
      expressionText.includes('profit') || expressionText.includes('revenue') || 
      expressionText.includes('income') || expressionText.includes('asset')) {
    if (!tags.includes('financial-metrics')) {
      tags.push('financial-metrics');
    }
  }
  
  if (nameText.includes('margin') || nameText.includes('profitability') ||
      expressionText.includes('margin') || expressionText.includes('net income')) {
    if (!tags.includes('profitability')) {
      tags.push('profitability');
    }
  }

  return {
    ...formula,
    id: ulid(),
    documentId,
    tags,
  };
}