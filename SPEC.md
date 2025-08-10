Ingestion → Function Reference System (IFRS)

Goal: ingest books/PDFs/articles and rewrite them into API-like function docs, claims, and definitions with strong provenance, stored in a lake + Postgres for fast, citeable retrieval.

Stack (opinionated MVP):
    •    Runtime: Bun + TypeScript
    •    DB: Neon Postgres (+ pgvector)
    •    Object store: S3/MinIO for raw/originals
    •    Local analytics: DuckDB (optional)
    •    Review UI: React + Vite (minimal)
    •    LLM: Claude (JSON-only tools for extraction)

⸻

Scope & Non-Goals

In-scope (MVP)
    •    Parse PDF/EPUB/HTML/MD → normalized blocks (with page/offset).
    •    Classify blocks (heading/para/list/table/code/quote).
    •    Extract Functions, Claims, Definitions with citations to spans.
    •    Store originals, metadata, spans, extracted units with embeddings.
    •    CLI to run ingest → extract → validate → load → ask.
    •    Small review UI to accept/reject/merge extractions.

Non-Goals (defer)
    •    Full OCR for scanned PDFs; advanced math/LaTeX parsing.
    •    Table structure recovery beyond plaintext rows.
    •    Cross-document ontology alignment; auto synonym expansion.
    •    Legal license resolution; full de-identification.
    •    Heavy data-lake infra (Iceberg/Glue). Start simple.

⸻

User Roles & Personas
    •    Owner (you): sets policies, approves merges, controls taxonomy.
    •    Operator: runs CLI, monitors queues.
    •    Consumer: queries functions/claims with citations.

⸻

Data Model (authoritative)

Postgres

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  uri TEXT UNIQUE,
  title TEXT,
  authors TEXT[],
  type TEXT CHECK (type IN ('pdf','epub','html','md','txt')),
  checksum TEXT NOT NULL,
  page_count INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE spans (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page INT,                -- null if not paged
  start_offset INT,
  end_offset INT,
  role TEXT CHECK (role IN ('heading','para','list','table','code','quote','figure','caption')),
  text TEXT NOT NULL,
  checksum TEXT NOT NULL
);

CREATE TABLE definitions (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  span_ids UUID[] NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.9,
  embedding VECTOR(1024)
);

CREATE TABLE claims (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  qualifiers JSONB NOT NULL DEFAULT '{}',  -- time, unit, scope, etc
  span_ids UUID[] NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.8,
  embedding VECTOR(1024)
);

CREATE TABLE functions (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '[]',
  preconditions JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',      -- [{n, text}]
  outputs JSONB NOT NULL DEFAULT '[]',
  failure_modes JSONB NOT NULL DEFAULT '[]',
  examples JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  span_ids UUID[] NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.75,
  embedding VECTOR(1024)
);

-- Search indexes
CREATE INDEX spans_doc_idx ON spans(document_id);
CREATE INDEX claims_fts ON claims USING GIN (to_tsvector('english', subject||' '||predicate||' '||object));
CREATE INDEX functions_fts ON functions USING GIN (to_tsvector('english', name||' '||purpose));

Object Store (S3/MinIO)

/raw/<documentId>/source.bin
/derived/<documentId>/text.jsonl          # block list w/ offsets, roles
/derived/<documentId>/preview.pdf         # optional


⸻

Core "Units" (schemas Claude must honor)

export type Span = {
  id: string; documentId: string; page: number|null;
  start: number; end: number; role: 'heading'|'para'|'list'|'table'|'code'|'quote'|'figure'|'caption';
  text: string; checksum: string;
};

export type FunctionDoc = {
  id: string; documentId: string; name: string; purpose: string;
  inputs: {name:string;type:string;required?:boolean;description?:string}[];
  preconditions: string[];
  steps: {n:number;text:string}[];
  outputs: {name:string;type:string;description?:string}[];
  failure_modes: string[];
  examples: {input:any;output:any;notes?:string}[];
  tags: string[];
  span_ids: string[];
  confidence: number;
};

export type Claim = {
  id: string; documentId: string;
  subject: string; predicate: string; object: string;
  qualifiers: Record<string, unknown>;
  span_ids: string[]; confidence: number;
};

export type Definition = {
  id: string; documentId: string; term: string; definition: string;
  aliases: string[]; span_ids: string[]; confidence: number;
};