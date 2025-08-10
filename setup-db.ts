#!/usr/bin/env bun
import { readFileSync } from 'fs';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ifrs';

async function setupDatabase() {
  console.log('🔗 Connecting to PostgreSQL...');
  const sql = postgres(DATABASE_URL);
  
  try {
    // Enable pgvector extension
    console.log('🧩 Enabling pgvector extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    
    // Read and execute migration
    console.log('📊 Running database migration...');
    const migration = readFileSync('./infra/sql/0001_init.sql', 'utf-8');
    await sql.unsafe(migration);
    
    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupDatabase();