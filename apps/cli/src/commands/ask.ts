import { Command } from 'commander';
import { loadConfig, formatCitations, type SpanCitation } from '../../../../packages/core/src/index.ts';
import { Database } from '../../../../packages/db/src/index.ts';
import { createEmbeddingProvider } from '../../../../packages/embeddings/src/index.ts';

export const askCommand = new Command()
  .name('ask')
  .description('Query functions and claims with citations')
  .argument('<query>', 'Query string')
  .option('--topk <k>', 'Number of results to return', '5')
  .option('--units <units>', 'Unit types to search', 'functions,claims')
  .option('--cite [type]', 'Citation style: auto, full, or none', 'auto')
  .option('--no-cite', 'Disable citations')
  .option('--no-vector', 'Disable vector search')
  .action(async (query: string, options) => {
    try {
      const config = loadConfig();
      const db = new Database(config);
      const limit = parseInt(options.topk);
      const unitTypes = options.units.split(',').map((u: string) => u.trim());
      const shouldCite = options.cite !== 'none' && !options.noCite;
      const citeStyle = options.cite || 'auto';
      
      console.log(`🔍 Searching for: "${query}"`);
      console.log(`   Units: ${unitTypes.join(', ')}`);
      console.log(`   Limit: ${limit}\n`);
      
      let queryEmbedding: number[] | undefined;
      
      // Generate query embedding if vector search is enabled
      if (options.vector !== false) {
        try {
          const embeddingProvider = createEmbeddingProvider(config);
          const embeddings = await embeddingProvider.embed([query]);
          queryEmbedding = embeddings[0];
          console.log(`✓ Generated query embedding\n`);
        } catch (error) {
          console.warn(`⚠️  Vector search disabled: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }
      }
      
      // Search each unit type
      const allResults: any[] = [];
      
      for (const unitType of unitTypes) {
        console.log(`📚 Searching ${unitType}:`);
        
        try {
          let results: any[] = [];
          
          switch (unitType) {
            case 'functions':
              results = await db.hybridSearchFunctions(query, queryEmbedding, limit);
              break;
            case 'claims':
              if (queryEmbedding) {
                results = await db.searchClaimsByVector(queryEmbedding, limit);
              } else {
                results = await db.searchClaims(query, limit);
              }
              break;
            case 'definitions':
              if (queryEmbedding) {
                results = await db.searchDefinitionsByVector(queryEmbedding, limit);
              } else {
                // Fallback to simple text search for definitions
                const allDefs = await db.sql`
                  SELECT * FROM definitions 
                  WHERE term ILIKE ${'%' + query + '%'} OR definition ILIKE ${'%' + query + '%'}
                  ORDER BY confidence DESC 
                  LIMIT ${limit}
                `;
                results = allDefs.map((row: any) => ({
                  id: row.id,
                  documentId: row.document_id,
                  term: row.term,
                  definition: row.definition,
                  aliases: row.aliases,
                  span_ids: row.span_ids,
                  confidence: row.confidence,
                }));
              }
              break;
            default:
              console.warn(`  Unknown unit type: ${unitType}`);
              continue;
          }
          
          if (results.length > 0) {
            console.log(`  Found ${results.length} ${unitType}`);
            allResults.push(...results.map(r => ({ ...r, unitType })));
          } else {
            console.log(`  No ${unitType} found`);
          }
          
        } catch (error) {
          console.error(`  Error searching ${unitType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Collect all span IDs for batch citation lookup
      const allSpanIds: string[] = [];
      if (shouldCite) {
        for (const result of allResults) {
          if (result.span_ids?.length > 0) {
            allSpanIds.push(...result.span_ids);
          }
        }
      }
      
      // Batch fetch citations before closing database
      const citationMap = new Map<string, {span_id: string, title: string, page: number}>();
      if (shouldCite && allSpanIds.length > 0) {
        try {
          const citations = await db.getSpanCitations(allSpanIds);
          for (const citation of citations) {
            citationMap.set(citation.span_id, citation);
          }
        } catch (error) {
          console.warn('Warning: Citation lookup failed, using fallback format');
        }
      }
      
      await db.close();
      
      // Display results
      if (allResults.length === 0) {
        console.log(`\n❌ No results found for "${query}"`);
        console.log(`💡 Try:\n  • Different keywords\n  • Broader search terms\n  • Check available documents with: bun ifrs list`);
        return;
      }
      
      console.log(`\n📋 Results (${allResults.length}):\n`);
      
      for (let i = 0; i < allResults.length; i++) {
        const result = allResults[i];
        const rank = i + 1;
        
        console.log(`${rank}. ${formatResultWithCitations(result, shouldCite, citeStyle, citationMap)}\n`);
      }
      
      console.log(`💡 Tips:`);
      console.log(`  • Use --cite for full citations`);
      console.log(`  • Try --units functions,claims,definitions for broader search`);
      console.log(`  • Use --topk 10 for more results`);
      
    } catch (error) {
      console.error('Error during search:', error);
      process.exit(1);
    }
  });

function formatResultWithCitations(result: any, includeCitations: boolean, citeStyle: string, citationMap: Map<string, {span_id: string, title: string, page: number}>): string {
  const confidence = result.confidence ? ` (conf: ${result.confidence.toFixed(2)})` : '';
  const distance = result.distance ? ` (dist: ${result.distance.toFixed(3)})` : '';
  
  let formatted = '';
  
  switch (result.unitType) {
    case 'functions':
      formatted = `🔧 FUNCTION: ${result.name}${confidence}${distance}
   Purpose: ${result.purpose}`;
      
      if (result.inputs) {
        const inputs = typeof result.inputs === 'string' ? JSON.parse(result.inputs) : result.inputs;
        if (inputs?.length > 0) {
          formatted += `
   Inputs: ${inputs.map((input: any) => `${input.name}:${input.type}`).join(', ')}`;
        }
      }
      
      if (result.steps) {
        const steps = typeof result.steps === 'string' ? JSON.parse(result.steps) : result.steps;
        if (steps?.length > 0) {
          formatted += `
   Steps:`;
          steps.slice(0, 3).forEach((step: any) => {
            formatted += `
     ${step.n}. ${step.text}`;
          });
          if (steps.length > 3) {
            formatted += `
     ... (${steps.length - 3} more steps)`;
          }
        }
      }
      break;
      
    case 'claims':
      formatted = `📊 CLAIM: ${result.subject} ${result.predicate} ${result.object}${confidence}${distance}`;
      if (Object.keys(result.qualifiers || {}).length > 0) {
        formatted += `
   Context: ${JSON.stringify(result.qualifiers)}`;
      }
      break;
      
    case 'definitions':
      formatted = `📖 DEFINITION: ${result.term}${confidence}${distance}
   Definition: ${result.definition}`;
      if (result.aliases?.length > 0) {
        formatted += `
   Aliases: ${result.aliases.join(', ')}`;
      }
      break;
      
    default:
      formatted = `❓ UNKNOWN: ${JSON.stringify(result)}`;
  }
  
  if (includeCitations && result.span_ids?.length > 0) {
    // Get citations from the pre-fetched map
    const resultCitations = result.span_ids
      .map((spanId: string) => citationMap.get(spanId))
      .filter((citation: any) => citation !== undefined);
    
    if (resultCitations.length > 0) {
      const formattedCitations = formatCitations(resultCitations);
      formatted += `\n   Citations: ${formattedCitations}`;
    } else {
      // Fallback to span IDs if citation lookup failed
      formatted += `\n   Citations: spans ${result.span_ids.slice(0, 3).join(', ')}${result.span_ids.length > 3 ? '...' : ''}`;
    }
  }
  
  return formatted;
}