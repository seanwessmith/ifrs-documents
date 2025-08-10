# IFRS Setup Guide

To resolve the "demo mode" limitation and enable full functionality, follow these steps:

## Quick Setup (Recommended)

### 1. Start Services
```bash
# Start PostgreSQL and MinIO with Docker
./setup-services.sh
```

This will:
- Start PostgreSQL with pgvector extension
- Start MinIO (S3-compatible storage)
- Create the database schema
- Create the S3 bucket
- Show service status

### 2. Test Full Functionality
```bash
bun ifrs ingest ~/Downloads/your-document.epub
```

You should now see:
```
✅ Document ingested successfully!
  Document ID: 01HKXYZ123...
  Spans extracted: 26
  Pages: 26
  
📋 Next steps:
  1. Extract units: bun ifrs extract 01HKXYZ123...
  2. Validate: bun ifrs validate 01HKXYZ123...
  3. Load: bun ifrs load 01HKXYZ123...
  4. Query: bun ifrs ask "your question here"
```

## Manual Setup

### Prerequisites
- Docker & Docker Compose
- PostgreSQL with pgvector extension
- MinIO or AWS S3

### 1. Start Services Manually
```bash
# Option A: Docker Compose
docker-compose up -d

# Option B: Manual PostgreSQL + MinIO setup
# (Install and configure PostgreSQL with pgvector)
# (Install and configure MinIO)
```

### 2. Setup Database
```bash
bun setup-db.ts
```

### 3. Setup S3 Bucket
```bash
bun setup-s3.ts
```

## Service URLs

- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **PostgreSQL**: localhost:5432 (postgres/password)

## Environment Variables

The `.env` file contains all necessary configuration:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/ifrs
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=ifrs-documents
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
CLAUDE_API_KEY=your_claude_api_key_here
```

## Troubleshooting

### Connection Refused
```bash
# Check if services are running
docker-compose ps

# Restart services
docker-compose down && docker-compose up -d
```

### Database Connection Issues
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Test connection manually
psql postgresql://postgres:password@localhost:5432/ifrs
```

### S3/MinIO Issues
```bash
# Check MinIO logs  
docker-compose logs minio

# Access MinIO console
open http://localhost:9001
```

## Stop Services
```bash
docker-compose down
```