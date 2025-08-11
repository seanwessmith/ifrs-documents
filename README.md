# Ingestion → Function Reference System (IFRS)

A system for ingesting books/PDFs/articles and rewriting them into API-like function docs, claims, and definitions with strong provenance, stored in a lake + Postgres for fast, citeable retrieval.

## Status: Phase 0 - MVP Foundation Complete ✓

The basic infrastructure for the IFRS system has been implemented:

### ✅ Completed Components

- **Repository Structure**: Monorepo with workspaces for apps and packages
- **Core Types**: Complete TypeScript definitions for all data models
- **Database Schema**: PostgreSQL schema with pgvector support
- **CLI Framework**: Commander-based CLI with subcommands
- **PDF Parser**: Basic PDF text extraction with block classification
- **Extractors**: Claude-based JSON extraction for functions, claims, definitions
- **Database Client**: PostgreSQL client with migrations and CRUD operations

### 📁 Project Structure

```
ifrs/
  apps/
    cli/                 # Bun CLI: ingest/extract/validate/load/ask
    review-ui/           # Minimal React review tool (placeholder)
  packages/
    core/                # Types, hashing, ULID, IO utils
    parsers/             # PDF/EPUB/HTML/MD → spans
    extractors/          # LLM prompts & JSON schemas
    db/                  # PostgreSQL client and migrations
  infra/
    sql/                 # Database migrations
    s3/                  # Bucket policies (dev)
  SPEC.md                # Complete technical specification
```

## Prerequisites

Before getting started, ensure you have:

1. **Bun runtime** (v1.0+): `curl -fsSL https://bun.sh/install | bash`
2. **PostgreSQL** with pgvector extension
3. **S3-compatible storage** (AWS S3 or MinIO)
4. **Claude API key** from Anthropic

## Quick Start

### 🚀 One-Command Pipeline (Recommended)

Process any document with a single command:

```bash
# Process a PDF with full pipeline
bun run ingest-doc path/to/document.pdf

# With custom metadata  
bun run ingest-doc document.pdf --title "Financial Guide" --authors "John Doe"

# Then search with AI
EMBEDDING_TYPE=openai bun ifrs ask "how to calculate profit"
```

See [PIPELINE.md](PIPELINE.md) for complete documentation.

### 📋 Manual Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd ifrs
   bun install
   ```

2. **Build Packages**
   ```bash
   # Build all workspace packages first
   bun run build
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Run migrations (requires DATABASE_URL)
   bun run packages/db/migrations
   ```

5. **Test CLI**
   ```bash
   bun ifrs --help
   # Should show IFRS command structure
   ```

## Configuration

Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/ifrs

# S3/MinIO Configuration
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=ifrs-documents
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Claude API
CLAUDE_API_KEY=your_claude_api_key_here

# IFRS Configuration
IFRS_CONFIDENCE_DEF=0.85
IFRS_CONFIDENCE_CLAIM=0.8
IFRS_CONFIDENCE_FUNC=0.75
IFRS_MAX_QUOTE_CHARS=300
```

## CLI Commands

The system is designed around these core commands:

```bash
# Ingest a document
bun ifrs ingest <path|url> --type pdf --title "Document Title" --authors "Author1,Author2"

# Extract units from document
bun ifrs extract <documentId> --units functions,claims,definitions --model claude

# Validate extracted units
bun ifrs validate <documentId> --strict

# Load validated units to database
bun ifrs load <documentId> --to postgres

# Query the knowledge base
bun ifrs ask "<query>" --topk 5 --units functions,claims --cite

# Review and approve extractions
bun ifrs review <documentId>
```

**Note**: The CLI requires building the workspace packages first. If you encounter "Cannot find module" errors, run `bun run build` to compile all packages.

## Data Model

### Documents
- **ID**: UUID
- **URI**: Source path/URL
- **Metadata**: Title, authors, type, checksum
- **Content**: Page count, creation timestamp

### Spans
- **Text Blocks**: With page/offset positions
- **Role Classification**: heading, paragraph, list, table, code, quote, figure, caption
- **Provenance**: Linked to source document and position

### Extracted Units

**Functions**: Procedural knowledge with inputs, steps, outputs
**Claims**: Factual assertions with subject-predicate-object structure
**Definitions**: Terms with canonical definitions and aliases

All units include:
- **Confidence scores** (0.0-1.0)
- **Span citations** (links back to source text)
- **Vector embeddings** (for semantic search)

## Architecture

### Stack
- **Runtime**: Bun + TypeScript
- **Database**: PostgreSQL + pgvector
- **Storage**: S3/MinIO for raw documents
- **LLM**: Claude (Anthropic) for extraction
- **Search**: Full-text search + vector similarity

### Processing Pipeline
1. **Ingest** → Parse document into spans
2. **Extract** → LLM processes spans into structured units
3. **Validate** → Rule-based validation of extractions
4. **Load** → Store in database with embeddings
5. **Query** → Hybrid retrieval with citations

## Development Status

**Phase 0 (✅ Complete)**: Foundation and core infrastructure
**Phase 1 (Next)**: End-to-end ingestion pipeline
**Phase 2**: Validation and quality assurance
**Phase 3**: Query and retrieval system
**Phase 4**: Review UI and human-in-the-loop

## Next Steps

To continue development:

1. **Fix Embeddings**: Fix dimension mismatch: expected 1024, got 384
2. **Create Review UI**: Simple React interface for human review

## Contributing

This system follows the detailed specification in `SPEC.md`. Key principles:

- **JSON-only extraction** with strict schema validation
- **Strong provenance** via span citations
- **Copyright-safe** with quote length limits
- **Modular architecture** for easy extension

For detailed implementation guidance, see the complete specification in `SPEC.md`.
