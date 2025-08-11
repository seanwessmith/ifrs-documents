# IFRS Pipeline - One-Command Document Processing

The IFRS system now includes a streamlined pipeline script that automates the complete document processing workflow in a single command.

## Quick Start

Process any document with one command:

```bash
# Simple usage - extracts functions only (recommended)
bun run ingest-doc path/to/document.pdf

# Full extraction (may hit rate limits on large documents)
bun run ingest-doc document.pdf --units functions,claims,definitions

# With custom title and authors
bun run ingest-doc document.pdf --title "Financial Analysis Guide" --authors "John Doe,Jane Smith"

# Process from URL
bun run ingest-doc https://example.com/document.pdf

# Different file types
bun run ingest-doc report.epub --type epub
bun run ingest-doc analysis.html --type html
```

### ⚠️ Rate Limits

Large documents may hit API rate limits during extraction:
- **Default**: Functions only (faster, fewer API calls)
- **Full extraction**: Add `--units functions,claims,definitions` (slower, more API calls)
- **If rate limited**: The system will automatically retry with exponential backoff

## What the Pipeline Does

The `ingest-doc` script automatically runs these steps:

1. **📥 Ingest Document** - Processes PDF/EPUB/HTML/MD files into spans
2. **🔧 Extract Units** - Uses AI to extract functions, claims, and definitions  
3. **✅ Validate** - Ensures extracted units meet quality standards
4. **💾 Load to Database** - Stores everything with OpenAI embeddings for search

## Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--title "Title"` | Custom document title | `--title "Accounting Handbook"` |
| `--authors "A,B"` | Comma-separated authors | `--authors "Smith,Jones"` |
| `--type <type>` | Force document type | `--type pdf` |
| `--units <units>` | Units to extract | `--units functions,claims` |
| `--model <model>` | AI model to use | `--model claude` |
| `--strict` | Enable strict validation | `--strict` |

## File Types Supported

- **PDF** - `.pdf` files
- **EPUB** - `.epub` ebooks  
- **HTML** - `.html` web pages
- **Markdown** - `.md` files
- **Text** - `.txt` files

## Example Output

```bash
$ bun run ingest-doc examples/accounting.pdf --title "Accounting Made Simple"

🚀 IFRS Document Processing Pipeline
=====================================
📄 Document: examples/accounting.pdf
📝 Title: Accounting Made Simple
👥 Authors: Auto-detected
📋 Type: pdf
🔧 Units: functions,claims,definitions
🤖 Model: claude
✅ Strict validation: false

🔄 Ingesting document...
✅ Document ingestion completed successfully

📋 Document ID: 23f73479-fb69-4719-b650-5f4c0c25968d

🔄 Extracting units...
✅ Extracting units completed successfully

🔄 Validating units...
✅ Validating units completed successfully

🔄 Loading to database with embeddings...
✅ Loading to database with embeddings completed successfully

🎉 Pipeline completed successfully!
=====================================
📄 Document processed: Accounting Made Simple
🆔 Document ID: 23f73479-fb69-4719-b650-5f4c0c25968d

🔍 Try these queries:
   EMBEDDING_TYPE=openai bun ifrs ask "your question here"
   bun ifrs review 23f73479-fb69-4719-b650-5f4c0c25968d

💡 Tips:
   • Use semantic queries like "how to calculate profit"
   • Try --topk 10 for more results
   • Use --cite for source citations
```

## After Processing

Once your document is processed, you can:

```bash
# Search with semantic understanding
EMBEDDING_TYPE=openai bun ifrs ask "how to calculate profitability"
EMBEDDING_TYPE=openai bun ifrs ask "what are financial statements"

# Get more results
EMBEDDING_TYPE=openai bun ifrs ask "accounting principles" --topk 10

# Include source citations  
EMBEDDING_TYPE=openai bun ifrs ask "balance sheet" --cite

# Review in UI (if available)
bun ifrs review 23f73479-fb69-4719-b650-5f4c0c25968d
```

## Environment Setup

Make sure these are configured:

```env
# .env file
DATABASE_URL=postgresql://postgres:password@localhost:5432/ifrs
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
```

## Troubleshooting

If the pipeline fails:

- ✅ **PostgreSQL running?** → `docker compose up -d`
- ✅ **API keys set?** → Check `.env` file  
- ✅ **Document accessible?** → Verify path/URL exists
- ✅ **Disk space?** → Large documents need storage space
- ✅ **Network?** → URLs need internet access

## Manual Pipeline (Advanced)

For more control, run steps individually:

```bash
# Step 1: Ingest
bun ifrs ingest document.pdf --title "My Doc" --authors "Me"

# Step 2: Extract (get document ID from step 1)
bun ifrs extract <documentId> --units functions,claims,definitions

# Step 3: Validate
bun ifrs validate <documentId>

# Step 4: Load with embeddings
EMBEDDING_TYPE=openai bun ifrs load <documentId>
```

This gives you granular control and lets you inspect outputs between steps.