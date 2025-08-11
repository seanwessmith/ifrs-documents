import { Command } from 'commander';
import { loadConfig, ulid } from '../../../../packages/core/src/index.ts';
import { Database } from '../../../../packages/db/src/index.ts';
import { createEmbeddingProvider, generateEmbeddings } from '../../../../packages/embeddings/src/index.ts';
import { createBackfillData } from '../../../../packages/extractors/src/backfill.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { Definition, Formula, FunctionDoc } from '../../../../packages/core/src/types.ts';

export const loadCommand = new Command()
  .name('load')
  .description('Load validated units to database')
  .argument('<documentId>', 'Document ID to load')
  .option('--to <target>', 'Target database', 'postgres')
  .option('--skip-embeddings', 'Skip embedding generation')
  .action(async (documentId: string, options) => {
    try {
      const config = loadConfig();
      const db = new Database(config);
      
      console.log(`Loading units for document: ${documentId}`);
      
      // Load and insert draft files
      const draftFiles = [
        { name: 'functions.jsonl', type: 'functions' },
        { name: 'claims.jsonl', type: 'claims' },
        { name: 'definitions.jsonl', type: 'definitions' },
        { name: 'formulas.jsonl', type: 'formulas' }
      ];
      
      let totalLoaded = 0;
      
      for (const draftFile of draftFiles) {
        const filePath = join(process.cwd(), 'temp', `derived/${documentId}/${draftFile.name}`);
        
        if (!existsSync(filePath)) {
          console.log(`Skipping ${draftFile.name} (not found)`);
          continue;
        }
        
        console.log(`\nLoading ${draftFile.name}:`);
        
        const fileContent = readFileSync(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          console.log(`  No units to load`);
          continue;
        }
        
        let units = lines.map(line => {
          const unit = JSON.parse(line);
          return {
            ...unit,
            documentId: documentId
          };
        });
        
        // Apply deduplication and enrichment based on CLAUDE.md spec
        if (draftFile.type === 'definitions') {
          units = (units as any[]).map(def => enrichDefinition(def, documentId));
          units = deduplicateDefinitions(units as Definition[]);
        } else if (draftFile.type === 'functions') {
          units = deduplicateFunctions(units as FunctionDoc[]);
        }
        
        // Insert units into database
        switch (draftFile.type) {
          case 'functions':
            await db.insertFunctions(units);
            console.log(`  ✓ Loaded ${units.length} functions`);
            break;
          case 'claims':
            await db.insertClaims(units);
            console.log(`  ✓ Loaded ${units.length} claims`);
            break;
          case 'definitions':
            await db.insertDefinitions(units);
            console.log(`  ✓ Loaded ${units.length} definitions`);
            break;
          case 'formulas':
            await db.insertFormulas(units);
            console.log(`  ✓ Loaded ${units.length} formulas`);
            break;
        }
        
        totalLoaded += units.length;
      }
      
      // Generate embeddings if not skipped
      if (!options.skipEmbeddings && totalLoaded > 0) {
        console.log(`\nGenerating embeddings:`);
        
        try {
          const embeddingProvider = createEmbeddingProvider(config);
          const unitsForEmbedding = await db.getUnitsForEmbedding(documentId);
          
          const allUnits = [
            ...unitsForEmbedding.functions.map(u => ({ ...u, type: 'function' })),
            ...unitsForEmbedding.claims.map(u => ({ ...u, type: 'claim' })),
            ...unitsForEmbedding.definitions.map(u => ({ ...u, type: 'definition' }))
          ];
          
          if (allUnits.length > 0) {
            const texts = allUnits.map(u => u.text);
            const embeddings = await generateEmbeddings(texts, embeddingProvider, 50);
            
            // Update embeddings in batches by type
            const functionUpdates = [];
            const claimUpdates = [];
            const definitionUpdates = [];
            
            for (let i = 0; i < allUnits.length; i++) {
              const unit = allUnits[i];
              const embedding = embeddings[i];
              
              switch (unit.type) {
                case 'function':
                  functionUpdates.push({ id: unit.id, embedding });
                  break;
                case 'claim':
                  claimUpdates.push({ id: unit.id, embedding });
                  break;
                case 'definition':
                  definitionUpdates.push({ id: unit.id, embedding });
                  break;
              }
            }
            
            // Update embeddings in database
            if (functionUpdates.length > 0) {
              await db.updateFunctionEmbeddings(functionUpdates);
              console.log(`  ✓ Updated ${functionUpdates.length} function embeddings`);
            }
            
            if (claimUpdates.length > 0) {
              await db.updateClaimEmbeddings(claimUpdates);
              console.log(`  ✓ Updated ${claimUpdates.length} claim embeddings`);
            }
            
            if (definitionUpdates.length > 0) {
              await db.updateDefinitionEmbeddings(definitionUpdates);
              console.log(`  ✓ Updated ${definitionUpdates.length} definition embeddings`);
            }
            
            console.log(`  Total embeddings generated: ${embeddings.length}`);
            
          } else {
            console.log(`  No units need embeddings`);
          }
          
        } catch (embeddingError) {
          console.warn(`  ⚠️  Embedding generation failed: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`);
          console.log(`  Units loaded without embeddings. Run load again to retry embeddings.`);
        }
      }
      
      // Skip backfill for now
      // console.log(`\nAdding backfill data for key financial formulas:`);
      
      await db.close();
      
      console.log(`\n✅ Load completed successfully!`);
      console.log(`  Total units loaded: ${totalLoaded}`);
      
      if (options.skipEmbeddings) {
        console.log(`  Embeddings skipped (use --skip-embeddings=false to generate)`);
      }
      
      console.log(`\n📚 Next steps:`);
      console.log(`  • Test queries: bun ifrs ask "your question here"`);
      console.log(`  • Review extractions: bun ifrs review ${documentId}`);
      
    } catch (error) {
      console.error('Error loading units:', error);
      process.exit(1);
    }
  });

function deduplicateDefinitions(definitions: Definition[]): Definition[] {
  const seen = new Map<string, Definition>();
  
  for (const def of definitions) {
    const key = `${def.documentId}:${def.term_slug}`;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, def);
    } else {
      // Keep highest confidence, or merge if same confidence
      if (def.confidence > existing.confidence) {
        seen.set(key, def);
      } else if (def.confidence === existing.confidence) {
        // Merge span_ids and aliases
        const mergedDef = {
          ...existing,
          span_ids: Array.from(new Set([...existing.span_ids, ...def.span_ids])),
          aliases: Array.from(new Set([...existing.aliases, ...def.aliases])),
          aliases_norm: Array.from(new Set([...existing.aliases_norm || [], ...def.aliases_norm || []]))
        };
        seen.set(key, mergedDef);
      }
    }
  }
  
  return Array.from(seen.values());
}

function deduplicateFunctions(functions: FunctionDoc[]): FunctionDoc[] {
  const seen = new Map<string, FunctionDoc>();
  
  for (const func of functions) {
    const stepsHash = createHash('sha256')
      .update(JSON.stringify(func.steps))
      .digest('hex')
      .substring(0, 16);
    
    const key = `${func.documentId}:${func.name}:${stepsHash}`;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, func);
    } else {
      // Keep highest confidence
      if (func.confidence > existing.confidence) {
        seen.set(key, func);
      }
    }
  }
  
  return Array.from(seen.values());
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

function enrichDefinition(def: any, documentId: string): Definition {
  const termSlug = createTermSlug(def.term || '');
  const aliasesNorm = normalizeAliases(def.aliases || []);
  
  // Auto-tag finance definitions
  const tags = def.tags || [];
  const defText = (def.definition || '').toLowerCase();
  const termText = (def.term || '').toLowerCase();
  
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
    documentId,
    term_slug: termSlug,
    aliases_norm: aliasesNorm.length > 0 ? aliasesNorm : [],
    tags: tags.length > 0 ? tags : [],
  };
}