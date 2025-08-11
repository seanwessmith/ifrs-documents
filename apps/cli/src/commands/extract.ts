import { Command } from 'commander';
import { loadConfig } from '../../../../packages/core/src/index.ts';
import { Database } from '../../../../packages/db/src/index.ts';
import { extractFunctions, extractClaims, extractDefinitions } from '../../../../packages/extractors/src/index.ts';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export const extractCommand = new Command()
  .name('extract')
  .description('Extract units from document spans')
  .argument('<documentId>', 'Document ID to extract from')
  .option('--units <units>', 'Comma-separated unit types to extract', 'functions,claims,definitions')
  .option('--model <model>', 'Model to use for extraction', 'claude')
  .action(async (documentId: string, options) => {
    try {
      const config = loadConfig();
      const db = new Database(config);
      
      console.log(`Extracting units from document: ${documentId}`);
      
      const spans = await db.getSpans(documentId);
      if (spans.length === 0) {
        console.error('No spans found for document');
        process.exit(1);
      }
      
      // Create drafts directory
      const draftsDir = join(process.cwd(), 'temp', 'derived', documentId);
      mkdirSync(draftsDir, { recursive: true });
      
      const unitTypes = options.units.split(',').map((u: string) => u.trim());
      let totalExtracted = 0;
      
      for (const unitType of unitTypes) {
        console.log(`Extracting ${unitType}...`);
        
        let result;
        let filename: string;
        
        switch (unitType) {
          case 'functions': {
            result = await extractFunctions(spans, config);
            filename = 'functions.jsonl';
            console.log(`  Extracted ${result.units.length} functions`);
            break;
          }
          case 'claims': {
            result = await extractClaims(spans, config);
            filename = 'claims.jsonl';
            console.log(`  Extracted ${result.units.length} claims`);
            break;
          }
          case 'definitions': {
            result = await extractDefinitions(spans, config);
            filename = 'definitions.jsonl';
            console.log(`  Extracted ${result.units.length} definitions`);
            break;
          }
          default:
            console.warn(`Unknown unit type: ${unitType}`);
            continue;
        }
        
        if (result.errors.length > 0) {
          console.warn(`  Errors: ${result.errors.length}`);
          result.errors.forEach(err => console.warn(`    ${err}`));
        }
        
        if (result.tokenCount) {
          console.log(`  Tokens used: ${result.tokenCount}`);
        }
        
        // Write results to JSONL file
        if (result.units.length > 0) {
          const filePath = join(draftsDir, filename);
          const jsonlContent = result.units
            .map(unit => JSON.stringify(unit))
            .join('\n');
          
          writeFileSync(filePath, jsonlContent);
          console.log(`  ✓ Wrote ${result.units.length} units to ${filePath}`);
          totalExtracted += result.units.length;
        }
      }
      
      await db.close();
      
      console.log(`\n✅ Extraction completed`);
      console.log(`  Total units extracted: ${totalExtracted}`);
      console.log(`  Draft files written to: ${draftsDir}`);
      
      if (totalExtracted > 0) {
        console.log(`\n📋 Next steps:`);
        console.log(`  1. Validate: bun ifrs validate ${documentId}`);
        console.log(`  2. Load: bun ifrs load ${documentId}`);
        console.log(`  3. Query: bun ifrs ask "your question here"`);
      }
      
    } catch (error) {
      console.error('Error extracting units:', error);
      process.exit(1);
    }
  });