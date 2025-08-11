#!/usr/bin/env bun

/**
 * Cost Estimation for IFRS Document Processing
 * 
 * Analyzes a document and estimates API costs before processing
 */

import { basename, extname } from 'path';
import { parseDocument } from '@ifrs/parsers';
import { loadConfig } from '@ifrs/core';

interface CostEstimate {
  document: {
    path: string;
    title: string;
    spans: number;
    pages: number;
  };
  extraction: {
    windows: {
      functions: number;
      claims: number;
      definitions: number;
    };
    tokens: {
      estimated: number;
      input: number;
      output: number;
    };
    costs: {
      claude: { input: number; output: number; total: number };
      openai: { input: number; output: number; total: number };
    };
  };
  embeddings: {
    units: number;
    tokens: number;
    cost: number;
  };
  total: {
    claude: number;
    openai: number;
  };
}

// Pricing per 1M tokens (as of 2024)
const PRICING = {
  claude: {
    input: 0.25,   // $0.25 per 1M input tokens (Haiku)
    output: 1.25   // $1.25 per 1M output tokens (Haiku)
  },
  openai: {
    extraction: {
      input: 0.50,   // GPT-4o mini input
      output: 1.50   // GPT-4o mini output
    },
    embeddings: 0.02  // text-embedding-3-small per 1M tokens
  }
};

function estimateExtractionWindows(spans: any[], windowSize: number = 5): number {
  const headings = spans.filter(span => span.role === 'heading');
  if (headings.length === 0) {
    return Math.ceil(spans.length / windowSize);
  }
  return headings.length; // Roughly one window per section
}

function estimateTokens(spans: any[]): { input: number; output: number } {
  // Rough estimation: 4 chars = 1 token
  const totalChars = spans.reduce((sum, span) => sum + span.text.length, 0);
  const inputTokens = Math.ceil(totalChars / 4);
  
  // System prompts + context overhead
  const systemPromptTokens = 1000;
  
  // Output tokens: estimated based on extraction complexity
  const outputTokensPerWindow = 800; // Average JSON response size
  
  return {
    input: inputTokens + systemPromptTokens,
    output: outputTokensPerWindow
  };
}

async function estimateCost(filePath: string): Promise<CostEstimate> {
  console.log(`🔍 Analyzing document: ${filePath}`);
  
  // Parse document to get spans
  const config = loadConfig();
  const document = await parseDocument(filePath, config);
  
  const spans = document.spans;
  const title = basename(filePath, extname(filePath));
  
  console.log(`📄 Parsed: ${spans.length} spans, ${document.pages} pages`);
  
  // Estimate extraction windows
  const functionWindows = estimateExtractionWindows(spans, 5);
  const claimWindows = estimateExtractionWindows(spans, 8);
  const definitionWindows = estimateExtractionWindows(spans, 6);
  
  // Estimate tokens per window
  const tokensPerWindow = estimateTokens(spans.slice(0, 5)); // Sample first 5 spans
  
  // Calculate total extraction costs
  const totalExtractionWindows = functionWindows + claimWindows + definitionWindows;
  const totalInputTokens = tokensPerWindow.input * totalExtractionWindows;
  const totalOutputTokens = tokensPerWindow.output * totalExtractionWindows;
  
  const claudeExtractionCost = 
    (totalInputTokens / 1_000_000 * PRICING.claude.input) +
    (totalOutputTokens / 1_000_000 * PRICING.claude.output);
  
  const openaiExtractionCost = 
    (totalInputTokens / 1_000_000 * PRICING.openai.extraction.input) +
    (totalOutputTokens / 1_000_000 * PRICING.openai.extraction.output);
  
  // Estimate embeddings (assume ~50% of windows produce valid units)
  const estimatedUnits = Math.ceil(totalExtractionWindows * 0.5);
  const embeddingTokens = estimatedUnits * 100; // ~100 tokens per unit description
  const embeddingCost = embeddingTokens / 1_000_000 * PRICING.openai.embeddings;
  
  return {
    document: {
      path: filePath,
      title,
      spans: spans.length,
      pages: document.pages
    },
    extraction: {
      windows: {
        functions: functionWindows,
        claims: claimWindows,
        definitions: definitionWindows
      },
      tokens: {
        estimated: totalInputTokens + totalOutputTokens,
        input: totalInputTokens,
        output: totalOutputTokens
      },
      costs: {
        claude: {
          input: totalInputTokens / 1_000_000 * PRICING.claude.input,
          output: totalOutputTokens / 1_000_000 * PRICING.claude.output,
          total: claudeExtractionCost
        },
        openai: {
          input: totalInputTokens / 1_000_000 * PRICING.openai.extraction.input,
          output: totalOutputTokens / 1_000_000 * PRICING.openai.extraction.output,
          total: openaiExtractionCost
        }
      }
    },
    embeddings: {
      units: estimatedUnits,
      tokens: embeddingTokens,
      cost: embeddingCost
    },
    total: {
      claude: claudeExtractionCost + embeddingCost,
      openai: openaiExtractionCost + embeddingCost
    }
  };
}

function formatCost(amount: number): string {
  if (amount < 0.01) return `$${(amount * 100).toFixed(2)}¢`;
  return `$${amount.toFixed(2)}`;
}

function displayEstimate(estimate: CostEstimate) {
  console.log('\n📊 COST ESTIMATE');
  console.log('='.repeat(50));
  
  console.log(`📄 Document: ${estimate.document.title}`);
  console.log(`   Spans: ${estimate.document.spans}, Pages: ${estimate.document.pages}`);
  
  console.log(`\n🔧 Extraction Windows:`);
  console.log(`   Functions: ${estimate.extraction.windows.functions} windows`);
  console.log(`   Claims: ${estimate.extraction.windows.claims} windows`);
  console.log(`   Definitions: ${estimate.extraction.windows.definitions} windows`);
  console.log(`   Total: ${estimate.extraction.windows.functions + estimate.extraction.windows.claims + estimate.extraction.windows.definitions} API calls`);
  
  console.log(`\n💰 Cost Breakdown:`);
  console.log(`   Claude (Haiku):`);
  console.log(`     Input tokens: ${estimate.extraction.tokens.input.toLocaleString()} @ ${formatCost(estimate.extraction.costs.claude.input)}`);
  console.log(`     Output tokens: ${estimate.extraction.tokens.output.toLocaleString()} @ ${formatCost(estimate.extraction.costs.claude.output)}`);
  console.log(`     Extraction: ${formatCost(estimate.extraction.costs.claude.total)}`);
  
  console.log(`\n   OpenAI (GPT-4o mini):`);
  console.log(`     Input tokens: ${estimate.extraction.tokens.input.toLocaleString()} @ ${formatCost(estimate.extraction.costs.openai.input)}`);
  console.log(`     Output tokens: ${estimate.extraction.tokens.output.toLocaleString()} @ ${formatCost(estimate.extraction.costs.openai.output)}`);
  console.log(`     Extraction: ${formatCost(estimate.extraction.costs.openai.total)}`);
  
  console.log(`\n   Embeddings (OpenAI):`);
  console.log(`     Estimated units: ${estimate.embeddings.units}`);
  console.log(`     Tokens: ${estimate.embeddings.tokens.toLocaleString()} @ ${formatCost(estimate.embeddings.cost)}`);
  
  console.log(`\n💵 TOTAL ESTIMATED COST:`);
  console.log(`   Claude + OpenAI embeddings: ${formatCost(estimate.total.claude)}`);
  console.log(`   OpenAI only: ${formatCost(estimate.total.openai)}`);
  
  console.log(`\n⏱️  Estimated processing time: ${Math.ceil((estimate.extraction.windows.functions + estimate.extraction.windows.claims + estimate.extraction.windows.definitions) * 3 / 60)} minutes`);
}

// CLI interface
async function main() {
  const filePath = Bun.argv[2];
  
  if (!filePath) {
    console.log('Usage: bun estimate-cost.ts <document-path>');
    process.exit(1);
  }
  
  try {
    const estimate = await estimateCost(filePath);
    displayEstimate(estimate);
    
    return estimate;
  } catch (error) {
    console.error('❌ Error estimating cost:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { estimateCost, displayEstimate, type CostEstimate };