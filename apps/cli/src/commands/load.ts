import { Command } from 'commander';
import { loadConfig } from '@ifrs/core';
import { Database } from '@ifrs/db';
import { createEmbeddingProvider, generateEmbeddings } from '@ifrs/embeddings';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
        { name: 'definitions.jsonl', type: 'definitions' }
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
        
        const units = lines.map(line => {
          const unit = JSON.parse(line);
          return {
            ...unit,
            documentId: documentId
          };
        });
        
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