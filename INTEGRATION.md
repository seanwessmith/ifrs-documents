# IFRS Integration & Testing Guide

## System Overview

The Ingestion → Function Reference System (IFRS) is now **Phase 1 Complete** with full end-to-end functionality:

- ✅ **Document Ingestion** with PDF parsing and S3 storage
- ✅ **Unit Extraction** using Claude API with JSON schema validation
- ✅ **Validation Pipeline** with comprehensive rule checking
- ✅ **Database Loading** with automatic embedding generation
- ✅ **Hybrid Search** combining full-text and vector similarity
- ✅ **Review Interface** for human-in-the-loop validation

## Quick Integration Test

### 1. Environment Setup

```bash
# 1. Install dependencies
bun install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# 3. Set up PostgreSQL with pgvector
createdb ifrs
psql -d ifrs -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -d ifrs -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# 4. Run migrations
bun run -c 'import { Database } from "./packages/db/src/client.js"; import { loadConfig } from "./packages/core/src/config.js"; const config = loadConfig(); const db = new Database(config); await db.migrate(); await db.close();'
```

### 2. End-to-End Test

```bash
# Test with a sample PDF document
curl -o test.pdf "https://www.w3.org/WAI/WCAG21/Understanding/understanding-techniques.pdf"

# 1. Ingest the document
bun ifrs ingest test.pdf --type pdf --title "WCAG Techniques" --authors "W3C"
# Note the returned Document ID

# 2. Extract units (replace DOC_ID with actual ID)
bun ifrs extract <DOC_ID> --units functions,claims,definitions

# 3. Validate extractions
bun ifrs validate <DOC_ID>

# 4. Load to database with embeddings
bun ifrs load <DOC_ID>

# 5. Test queries
bun ifrs ask "accessibility guidelines" --topk 3 --cite
bun ifrs ask "web content" --units definitions

# 6. Open review interface
bun ifrs review <DOC_ID>
```

## Architecture Components

### Core Packages

1. **@ifrs/core** - Types, utilities, configuration
2. **@ifrs/db** - PostgreSQL client with vector search
3. **@ifrs/parsers** - Document parsing (PDF, EPUB, HTML, MD)
4. **@ifrs/extractors** - Claude-based unit extraction
5. **@ifrs/embeddings** - Vector embedding providers

### Applications

1. **@ifrs/cli** - Command-line interface
2. **@ifrs/review-ui** - Web-based review interface

## CLI Commands Reference

### `bun ifrs ingest <path>`
Ingest documents and extract spans.

**Options:**
- `--type <type>` - Document type (pdf, epub, html, md, txt)
- `--title <title>` - Document title
- `--authors <authors>` - Comma-separated authors

**Example:**
```bash
bun ifrs ingest ./research.pdf --type pdf --title "ML Research Paper" --authors "Smith,Jones"
```

### `bun ifrs extract <documentId>`
Extract structured units from document spans.

**Options:**
- `--units <units>` - Unit types to extract (functions,claims,definitions)
- `--model <model>` - LLM model to use (claude)

**Example:**
```bash
bun ifrs extract abc123 --units functions,definitions --model claude
```

### `bun ifrs validate <documentId>`
Validate extracted units against rules.

**Options:**
- `--strict` - Use strict validation rules (exits on any error)

**Example:**
```bash
bun ifrs validate abc123 --strict
```

### `bun ifrs load <documentId>`
Load validated units to database with embeddings.

**Options:**
- `--to <target>` - Target database (postgres)
- `--skip-embeddings` - Skip embedding generation

**Example:**
```bash
bun ifrs load abc123 --skip-embeddings
```

### `bun ifrs ask "<query>"`
Query the knowledge base with hybrid search.

**Options:**
- `--topk <k>` - Number of results (default: 5)
- `--units <units>` - Unit types to search (functions,claims,definitions)
- `--cite` - Include span citations
- `--no-vector` - Disable vector search

**Example:**
```bash
bun ifrs ask "machine learning algorithms" --topk 10 --units functions --cite
```

### `bun ifrs review [documentId]`
Open web-based review interface.

**Options:**
- `--port <port>` - Server port (default: 3001)

**Example:**
```bash
bun ifrs review abc123 --port 3002
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ifrs

# Object Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=ifrs-documents  
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# LLM API
CLAUDE_API_KEY=sk-ant-api03-...

# Confidence Thresholds
IFRS_CONFIDENCE_DEF=0.85    # Definitions
IFRS_CONFIDENCE_CLAIM=0.8   # Claims  
IFRS_CONFIDENCE_FUNC=0.75   # Functions

# Content Limits
IFRS_MAX_QUOTE_CHARS=300

# Embeddings (optional)
EMBEDDING_TYPE=local        # local|openai|claude
OPENAI_API_KEY=sk-...       # If using OpenAI embeddings
```

### Database Schema

The system uses PostgreSQL with the pgvector extension:

- **documents** - Document metadata and checksums
- **spans** - Text spans with role classification and positions
- **functions** - Extracted procedural knowledge
- **claims** - Factual assertions with qualifiers
- **definitions** - Term definitions with aliases

All units include:
- **confidence** scores for quality assessment
- **span_ids** arrays for provenance
- **embeddings** for semantic search

## Data Flow

```
PDF/EPUB/etc → Parse → Spans → Extract → Validate → Load → Query
     ↓           ↓       ↓        ↓        ↓       ↓      ↓
   S3 Raw    S3 Text   DB     Drafts   Review   DB    Results
```

1. **Ingest**: Document → spans with role classification
2. **Extract**: Spans → structured units (functions/claims/definitions)  
3. **Validate**: Apply confidence thresholds and rule checking
4. **Load**: Insert validated units with embeddings
5. **Query**: Hybrid search (FTS + vector similarity)

## Quality Assurance

### Validation Rules

- **Functions**: Step numbering (1..N), span citations, confidence thresholds
- **Claims**: Subject-predicate-object structure, qualifier validation  
- **Definitions**: Term length limits, citation requirements
- **All Units**: Quote length limits (copyright protection), span ID validation

### Confidence Scoring

Units are scored by the LLM and filtered by configurable thresholds:
- **High confidence** (>0.8): Automatically approved
- **Medium confidence** (0.6-0.8): Requires human review
- **Low confidence** (<0.6): Rejected or flagged for editing

## Performance Considerations

### Scaling Guidelines

- **Ingestion**: ~5 pages/sec for text PDFs locally
- **Extraction**: Batched API calls with rate limiting
- **Database**: Bulk inserts with prepared statements
- **Search**: Hybrid queries with result caching

### Optimization Strategies

1. **Batch Processing**: Process multiple documents in parallel
2. **Caching**: Cache frequent queries and embeddings
3. **Indexing**: Create vector indexes after bulk loading
4. **Monitoring**: Track API costs and token usage

## Troubleshooting

### Common Issues

1. **Module Resolution Errors**
   - Run `bun install` in root directory
   - Check workspace references in package.json files

2. **Database Connection**
   - Verify DATABASE_URL in .env
   - Ensure PostgreSQL is running with pgvector extension

3. **S3/MinIO Access**
   - Check S3 credentials and endpoint configuration
   - Verify bucket exists and is accessible

4. **Claude API Issues**
   - Validate CLAUDE_API_KEY format
   - Check API rate limits and quotas

5. **Embedding Generation**
   - Local embeddings use placeholder random vectors
   - For production, use OpenAI or deploy sentence-transformers

### Debug Mode

Enable verbose logging:

```bash
export DEBUG=ifrs:*
bun ifrs ingest document.pdf --type pdf
```

## Production Deployment

### Prerequisites

- PostgreSQL 14+ with pgvector extension
- S3-compatible object storage
- Claude API access (or alternative LLM)
- Node.js/Bun runtime environment

### Scaling Recommendations

- Use managed PostgreSQL (e.g., Neon, RDS)
- Deploy worker queues for extraction pipeline
- Implement result caching (Redis)
- Monitor costs and token usage
- Set up automated backups

## API Integration

The review UI exposes REST endpoints that can be used for programmatic access:

```javascript
// Get all documents
GET /api/documents

// Get units for a document
GET /api/units/{documentId}?type=functions&status=pending

// Update unit status (future)
PATCH /api/units/{unitId} 
```

## Next Phase Development

**Phase 2** priorities:
- Cross-document deduplication
- Advanced table/figure extraction  
- Custom domain vocabularies
- Batch processing workflows
- API authentication
- Multi-tenant support

The system architecture supports these extensions through the modular package structure and extensible data models.