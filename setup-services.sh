#!/bin/bash
set -e

echo "🚀 Setting up IFRS services..."

# Start Docker services
echo "📦 Starting PostgreSQL and MinIO..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker-compose exec -T postgres pg_isready -U postgres; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# Run database migrations
echo "📊 Setting up database schema..."
bun run setup-db.ts

# Create S3 bucket
echo "🗄️ Creating S3 bucket..."
bun run setup-s3.ts

echo "✅ Services are ready!"
echo ""
echo "🎯 Next steps:"
echo "  • Run: bun ifrs ingest <file> (full functionality)"
echo "  • View MinIO console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "🛑 To stop services: docker-compose down"