#!/usr/bin/env bun

import { Database } from './packages/db/src/client';
import { loadConfig } from './packages/core/src/config';

async function checkDatabase() {
  console.log('🔍 Checking database contents...\n');
  
  const config = loadConfig();
  const db = new Database(config);
  
  try {
    // Check documents
    const documents = await db.sql`SELECT id, title, type, page_count FROM documents`;
    console.log(`📄 Documents: ${documents.length}`);
    if (documents.length > 0) {
      documents.forEach((doc: any) => {
        console.log(`  - ${doc.title} (${doc.type}, ${doc.page_count} pages)`);
        console.log(`    ID: ${doc.id}`);
      });
    }
    
    // Check functions
    const functionCount = await db.sql`SELECT COUNT(*) as count FROM functions`;
    console.log(`\n🔧 Functions: ${functionCount[0].count}`);
    
    // Check claims
    const claimCount = await db.sql`SELECT COUNT(*) as count FROM claims`;
    console.log(`📊 Claims: ${claimCount[0].count}`);
    
    // Check definitions
    const defCount = await db.sql`SELECT COUNT(*) as count FROM definitions`;
    console.log(`📖 Definitions: ${defCount[0].count}`);
    
    // Check if embeddings exist
    const embeddingStats = await db.sql`
      SELECT 
        (SELECT COUNT(*) FROM functions WHERE embedding IS NOT NULL) as func_embeddings,
        (SELECT COUNT(*) FROM claims WHERE embedding IS NOT NULL) as claim_embeddings,
        (SELECT COUNT(*) FROM definitions WHERE embedding IS NOT NULL) as def_embeddings
    `;
    
    console.log(`\n🔤 Embeddings:`);
    console.log(`  Functions: ${embeddingStats[0].func_embeddings}`);
    console.log(`  Claims: ${embeddingStats[0].claim_embeddings}`);
    console.log(`  Definitions: ${embeddingStats[0].def_embeddings}`);
    
    // Sample search test
    if (functionCount[0].count > 0) {
      console.log('\n🧪 Testing text search for "finance":');
      const results = await db.sql`
        SELECT name, purpose FROM functions 
        WHERE to_tsvector('english', name || ' ' || purpose) @@ plainto_tsquery('english', 'finance')
        LIMIT 5
      `;
      
      if (results.length > 0) {
        console.log(`  Found ${results.length} results:`);
        results.forEach((r: any) => console.log(`    - ${r.name}: ${r.purpose}`));
      } else {
        console.log('  No results found for "finance" in functions');
        
        // Check what terms exist
        console.log('\n  Sample function names:');
        const sampleFuncs = await db.sql`SELECT name FROM functions LIMIT 5`;
        sampleFuncs.forEach((f: any) => console.log(`    - ${f.name}`));
      }
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await db.close();
  }
}

checkDatabase();