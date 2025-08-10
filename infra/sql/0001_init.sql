-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uri TEXT UNIQUE NOT NULL,
  title TEXT,
  authors TEXT[] DEFAULT '{}',
  type TEXT NOT NULL CHECK (type IN ('pdf','epub','html','md','txt')),
  checksum TEXT NOT NULL,
  page_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spans table
CREATE TABLE spans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page INT,
  start_offset INT NOT NULL,
  end_offset INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('heading','para','list','table','code','quote','figure','caption')),
  text TEXT NOT NULL,
  checksum TEXT NOT NULL
);

-- Definitions table
CREATE TABLE definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  span_ids UUID[] NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.9,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims table
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  qualifiers JSONB NOT NULL DEFAULT '{}',
  span_ids UUID[] NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.8,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Functions table
CREATE TABLE functions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '[]',
  preconditions JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  outputs JSONB NOT NULL DEFAULT '[]',
  failure_modes JSONB NOT NULL DEFAULT '[]',
  examples JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  span_ids UUID[] NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.75,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX spans_document_idx ON spans(document_id);
CREATE INDEX spans_role_idx ON spans(role);
CREATE INDEX spans_checksum_idx ON spans(checksum);

CREATE INDEX definitions_document_idx ON definitions(document_id);
CREATE INDEX definitions_term_idx ON definitions(term);
CREATE INDEX definitions_confidence_idx ON definitions(confidence);
CREATE INDEX definitions_fts ON definitions USING GIN (to_tsvector('english', term || ' ' || definition));

CREATE INDEX claims_document_idx ON claims(document_id);
CREATE INDEX claims_confidence_idx ON claims(confidence);
CREATE INDEX claims_fts ON claims USING GIN (to_tsvector('english', subject || ' ' || predicate || ' ' || object));

CREATE INDEX functions_document_idx ON functions(document_id);
CREATE INDEX functions_confidence_idx ON functions(confidence);
CREATE INDEX functions_tags_idx ON functions USING GIN (tags);
CREATE INDEX functions_fts ON functions USING GIN (to_tsvector('english', name || ' ' || purpose));

-- Vector indexes (create after data is loaded for better performance)
-- CREATE INDEX definitions_embedding_idx ON definitions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX claims_embedding_idx ON claims USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX functions_embedding_idx ON functions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);