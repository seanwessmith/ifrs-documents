#!/usr/bin/env bun

/**
 * IFRS Document Ingestion Pipeline
 * 
 * Automates the complete document processing pipeline:
 * 1. Ingest document (PDF/EPUB/etc)
 * 2. Extract units (functions, claims, definitions)
 * 3. Validate extracted units
 * 4. Load to database with embeddings
 * 
 * Usage:
 *   bun run ingest-doc path/to/document.pdf
 *   bun run ingest-doc https://example.com/doc.pdf --title "Custom Title"
 *   bun run ingest-doc document.epub --authors "Author1,Author2" --type epub
 */

import { basename, extname } from 'path';
import { estimateCost, displayEstimate, type CostEstimate } from './estimate-cost.js';

// Simple prompt function for Bun
async function promptUser(message: string): Promise<string> {
  process.stdout.write(message);
  for await (const line of console) {
    return line.trim();
  }
  return '';
}

// Parse command line arguments
function parseArgs() {
  const args = Bun.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('🚀 IFRS Document Processing Pipeline');
    console.log('=====================================');
    console.log('\nAutomatically processes documents through the complete IFRS pipeline:');
    console.log('1. Ingest → 2. Extract → 3. Validate → 4. Load with embeddings\n');
    console.log('Usage:');
    console.log('  bun run ingest-doc <path|url> [options]');
    console.log('\nExamples:');
    console.log('  bun run ingest-doc document.pdf');
    console.log('  bun run ingest-doc document.pdf --title "Custom Title"');
    console.log('  bun run ingest-doc document.epub --authors "Author1,Author2"');
    console.log('  bun run ingest-doc https://example.com/doc.pdf');
    console.log('\nOptions:');
    console.log('  --title "Title"     Custom document title');
    console.log('  --authors "A,B"     Comma-separated authors');
    console.log('  --type <type>       Force document type (pdf, epub, html, md, txt)');
    console.log('  --units <units>     Units to extract (default: functions)');
    console.log('  --model <model>     AI model to use (claude, openai, default: claude)');
    console.log('  --strict            Enable strict validation');
    console.log('  --force             Overwrite existing document');
    console.log('  --yes, -y           Skip cost approval prompt');
    console.log('  --help, -h          Show this help');
    console.log('\nSupported file types: PDF, EPUB, HTML, Markdown, Text');
    process.exit(0);
  }

  const filePath = args[0];
  const options = {
    title: null as string | null,
    authors: null as string | null,
    type: null as string | null,
    units: 'functions', // Default to functions only to avoid rate limits
    model: 'claude',
    strict: false,
    force: false,
    skipApproval: false
  };

  // Parse flags
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title' && i + 1 < args.length) {
      options.title = args[++i];
    } else if (arg === '--authors' && i + 1 < args.length) {
      options.authors = args[++i];
    } else if (arg === '--type' && i + 1 < args.length) {
      options.type = args[++i];
    } else if (arg === '--units' && i + 1 < args.length) {
      options.units = args[++i];
    } else if (arg === '--model' && i + 1 < args.length) {
      options.model = args[++i];
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.skipApproval = true;
    }
  }

  // Auto-detect type from extension if not provided
  if (!options.type && !filePath.startsWith('http')) {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.pdf') options.type = 'pdf';
    else if (ext === '.epub') options.type = 'epub';
    else if (ext === '.html' || ext === '.htm') options.type = 'html';
    else if (ext === '.md') options.type = 'md';
    else if (ext === '.txt') options.type = 'txt';
  }

  // Default title from filename
  if (!options.title) {
    options.title = basename(filePath, extname(filePath));
  }

  return { filePath, options };
}

// Execute command and return promise
async function execCommand(cmdArray: string[], description: string): Promise<void> {
  console.log(`\n🔄 ${description}...`);
  console.log(`   Command: ${cmdArray.join(' ')}`);
  
  const proc = Bun.spawn(cmdArray, {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, EMBEDDING_TYPE: 'openai' }
  });
  
  const exitCode = await proc.exited;
  
  if (exitCode === 0) {
    console.log(`✅ ${description} completed successfully`);
  } else {
    console.error(`❌ ${description} failed with exit code ${exitCode}`);
    throw new Error(`${description} failed`);
  }
}

// Extract document ID from ingest output
async function extractDocumentId(cmdArray: string[]): Promise<string> {
  console.log(`\n🔄 Ingesting document...`);
  console.log(`   Command: ${cmdArray.join(' ')}`);
  
  const proc = Bun.spawn(cmdArray, {
    stdio: ['inherit', 'pipe', 'inherit']
  });
  
  let output = '';
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      output += chunk;
      process.stdout.write(chunk); // Also display to user
    }
  } finally {
    reader.releaseLock();
  }
  
  const exitCode = await proc.exited;
  
  if (exitCode === 0) {
    console.log(`✅ Document ingestion completed successfully`);
    
    // Extract document ID from output
    const idMatch = output.match(/Document ID: ([a-f0-9-]+)/);
    if (idMatch) {
      return idMatch[1];
    } else {
      console.error('❌ Could not extract document ID from output');
      throw new Error('Failed to extract document ID');
    }
  } else {
    console.error(`❌ Document ingestion failed with exit code ${exitCode}`);
    throw new Error('Document ingestion failed');
  }
}

// Main pipeline execution
async function runPipeline() {
  const { filePath, options } = parseArgs();
  
  console.log('🚀 IFRS Document Processing Pipeline');
  console.log('=====================================');
  console.log(`📄 Document: ${filePath}`);
  console.log(`📝 Title: ${options.title}`);
  console.log(`👥 Authors: ${options.authors || 'Auto-detected'}`);
  console.log(`📋 Type: ${options.type || 'Auto-detected'}`);
  console.log(`🔧 Units: ${options.units}`);
  console.log(`🤖 Model: ${options.model}`);
  console.log(`✅ Strict validation: ${options.strict}`);
  
  try {
    // Step 0: Cost estimation and approval
    if (!options.skipApproval) {
      console.log('\n🔍 Analyzing document for cost estimation...');
      
      try {
        const estimate = await estimateCost(filePath);
        displayEstimate(estimate);
        
        // Approval prompt
        console.log('\n❓ Proceed with processing?');
        console.log('   Type "yes" to continue, or Ctrl+C to cancel');
        
        const response = await promptUser('Continue? (yes/no): ');
        
        if (response.toLowerCase() !== 'yes' && response.toLowerCase() !== 'y') {
          console.log('⏹️  Processing cancelled by user');
          process.exit(0);
        }
        
        console.log('✅ User approved, proceeding with processing...');
        
      } catch (error) {
        console.warn('⚠️  Could not estimate cost, proceeding anyway...');
        console.warn(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Step 1: Ingest document
    const ingestCmd = ['bun', 'apps/cli/src/index.ts', 'ingest', filePath];
    if (options.type) {
      ingestCmd.push('--type', options.type);
    }
    if (options.title) {
      ingestCmd.push('--title', options.title);
    }
    if (options.authors) {
      ingestCmd.push('--authors', options.authors);
    }
    if (options.force) {
      ingestCmd.push('--force');
    }
    
    const documentId = await extractDocumentId(ingestCmd);
    console.log(`\n📋 Document ID: ${documentId}`);
    
    // Step 2: Extract units
    const extractCmd = ['bun', 'apps/cli/src/index.ts', 'extract', documentId];
    if (options.units) {
      extractCmd.push('--units', options.units);
    }
    if (options.model) {
      extractCmd.push('--model', options.model);
    }
    
    await execCommand(extractCmd, 'Extracting units');
    
    // Step 3: Validate extracted units
    const validateCmd = ['bun', 'apps/cli/src/index.ts', 'validate', documentId];
    if (options.strict) {
      validateCmd.push('--strict');
    }
    
    await execCommand(validateCmd, 'Validating units');
    
    // Step 4: Load to database with embeddings
    const loadCmd = ['bun', 'apps/cli/src/index.ts', 'load', documentId];
    await execCommand(loadCmd, 'Loading to database with embeddings');
    
    // Success summary
    console.log('\n🎉 Pipeline completed successfully!');
    console.log('=====================================');
    console.log(`📄 Document processed: ${options.title}`);
    console.log(`🆔 Document ID: ${documentId}`);
    console.log('\n🔍 Try these queries:');
    console.log(`   EMBEDDING_TYPE=openai bun ifrs ask "your question here"`);
    console.log(`   bun ifrs review ${documentId}`);
    console.log('\n💡 Tips:');
    console.log('   • Use semantic queries like "how to calculate profit"');
    console.log('   • Try --topk 10 for more results');
    console.log('   • Use --cite for source citations');
    console.log('\n📚 Example queries for this document:');
    console.log('   • "What are financial ratios?"');
    console.log('   • "How do I prepare an income statement?"');
    console.log('   • "What is the accounting equation?"');
    
  } catch (error) {
    console.error('\n💥 Pipeline failed:', error instanceof Error ? error.message : 'Unknown error');
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Check that PostgreSQL is running (docker compose up)');
    console.log('   • Verify OPENAI_API_KEY is set in .env');
    console.log('   • Ensure document path/URL is accessible');
    console.log('   • Check logs above for specific error details');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n⏹️ Pipeline interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️ Pipeline terminated');
  process.exit(1);
});

// Run the pipeline
try {
  await runPipeline();
} catch (error) {
  console.error('Unexpected error:', error);
  process.exit(1);
}