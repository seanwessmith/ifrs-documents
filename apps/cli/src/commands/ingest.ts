import { Command } from 'commander';
import { loadConfig, readFileOrUrl, hashDocument, ulid } from '@ifrs/core';
import { Database } from '@ifrs/db';
import { parseDocument } from '@ifrs/parsers';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync } from 'fs';
import { join } from 'path';

export const ingestCommand = new Command()
  .name('ingest')
  .description('Ingest a document and extract spans')
  .argument('<path>', 'Path or URL to document')
  .option('--type <type>', 'Document type (auto-detected if not specified)')
  .option('--title <title>', 'Document title')
  .option('--authors <authors>', 'Comma-separated authors')
  .option('--force', 'Overwrite existing document if it exists')
  .action(async (path: string, options) => {
    try {
      const config = loadConfig();
      const db = new Database(config);
      
      const s3 = new S3Client({
        endpoint: config.s3.endpoint,
        region: 'us-west-2',
        credentials: {
          accessKeyId: config.s3.accessKey,
          secretAccessKey: config.s3.secretKey,
        },
        forcePathStyle: true,
      });

      console.log(`Ingesting document from: ${path}`);
      
      const content = await readFileOrUrl(path);
      const checksum = hashDocument(content);
      const documentId = ulid();
      
      // Auto-detect file type if not specified
      const detectedType = options.type || detectFileType(path);
      console.log(`Document type: ${detectedType}`);
      
      const document = {
        uri: path,
        title: options.title || path.split('/').pop() || 'Untitled',
        authors: options.authors ? options.authors.split(',').map((a: string) => a.trim()) : [],
        type: detectedType as any,
        checksum,
      };

      console.log('Parsing document...');
      const parseResult = await parseDocument(content, detectedType);
      
      console.log('✓ Document parsed successfully');
      console.log(`  Spans extracted: ${parseResult.spans.length}`);
      console.log(`  Pages: ${parseResult.pageCount || 'N/A'}`);
      
      console.log('Uploading to S3...', JSON.stringify(config.s3.bucket));
      await s3.send(new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: `raw/${documentId}/source.bin`,
        Body: content,
        ContentType: getContentType(detectedType),
      }));

      const derivedJsonl = parseResult.spans.map(span => JSON.stringify({
        id: span.id,
        role: span.role,
        page: span.page,
        start: span.start,
        end: span.end,
        text: span.text,
      })).join('\n');

      await s3.send(new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: `derived/${documentId}/text.jsonl`,
        Body: derivedJsonl,
        ContentType: 'application/jsonl',
      }));

      console.log('Inserting into database...');
      const docToInsert = {
        ...document,
        pageCount: parseResult.pageCount,
      };
      
      let insertedDocId: string;
      
      try {
        insertedDocId = await db.insertDocument(docToInsert);
      } catch (error: any) {
        if (error.code === '23505' && error.constraint_name === 'documents_uri_key') {
          // Document already exists
          if (options.force) {
            console.log('⚠️  Document already exists, updating...');
            const existingDoc = await db.getDocumentByUri(document.uri);
            if (existingDoc) {
              insertedDocId = existingDoc.id;
              // Clear existing spans for this document
              await db.deleteSpansForDocument(insertedDocId);
              await db.updateDocument(insertedDocId, docToInsert);
            } else {
              throw new Error('Document exists but could not be retrieved');
            }
          } else {
            console.error('\n❌ Document already exists in database');
            console.error(`   URI: ${document.uri}`);
            console.error('\n💡 Options:');
            console.error('   • Use --force to overwrite the existing document');
            console.error('   • Use a different file path');
            console.error('   • Delete the existing document from the database first');
            process.exit(1);
          }
        } else {
          throw error; // Re-throw other database errors
        }
      }
      
      const spansWithDocId = parseResult.spans.map(span => ({
        ...span,
        documentId: insertedDocId,
      }));
      
      await db.insertSpans(spansWithDocId);
      await db.close();

      console.log(`\n✅ Document ingested successfully!`);
      console.log(`  Document ID: ${insertedDocId}`);
      console.log(`  Document: ${document.title}`);
      console.log(`  Type: ${detectedType.toUpperCase()}`);
      console.log(`  Spans extracted: ${parseResult.spans.length}`);
      console.log(`  Pages: ${parseResult.pageCount || 'N/A'}`);
      
      console.log(`\n📋 Next steps:`);
      console.log(`  1. Extract units: bun ifrs extract ${insertedDocId}`);
      console.log(`  2. Validate: bun ifrs validate ${insertedDocId}`);
      console.log(`  3. Load: bun ifrs load ${insertedDocId}`);
      console.log(`  4. Query: bun ifrs ask "your question here"`);
      
    } catch (error) {
      console.error('Error ingesting document:', error);
      process.exit(1);
    }
  });

function detectFileType(path: string): string {
  const ext = path.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'epub': return 'epub';
    case 'html': 
    case 'htm': return 'html';
    case 'md': 
    case 'markdown': return 'md';
    case 'txt': return 'txt';
    default: return 'pdf'; // Default fallback
  }
}

function getContentType(type: string): string {
  switch (type) {
    case 'pdf': return 'application/pdf';
    case 'epub': return 'application/epub+zip';
    case 'html': return 'text/html';
    case 'md': return 'text/markdown';
    case 'txt': return 'text/plain';
    default: return 'application/octet-stream';
  }
}