export type DocumentType = 'pdf' | 'epub' | 'html' | 'md' | 'txt';

export type SpanRole = 'heading' | 'para' | 'list' | 'table' | 'code' | 'quote' | 'figure' | 'caption';

export interface Span {
  id: string;
  documentId: string;
  page: number | null;
  start: number;
  end: number;
  role: SpanRole;
  text: string;
  checksum: string;
}

export interface Document {
  id: string;
  uri: string;
  title: string;
  authors: string[];
  type: DocumentType;
  checksum: string;
  pageCount?: number;
  createdAt: Date;
}

export interface FunctionInput {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface FunctionOutput {
  name: string;
  type: string;
  description?: string;
}

export interface FunctionStep {
  n: number;
  text: string;
}

export interface FunctionExample {
  input: any;
  output: any;
  notes?: string;
}

export interface FunctionDoc {
  id: string;
  documentId: string;
  name: string;
  purpose: string;
  inputs: FunctionInput[];
  preconditions: string[];
  steps: FunctionStep[];
  outputs: FunctionOutput[];
  failure_modes: string[];
  examples: FunctionExample[];
  tags: string[];
  span_ids: string[];
  confidence: number;
}

export interface Claim {
  id: string;
  documentId: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers: Record<string, unknown>;
  span_ids: string[];
  confidence: number;
}

export interface Definition {
  id: string;
  documentId: string;
  term: string;
  definition: string;
  aliases: string[];
  span_ids: string[];
  confidence: number;
}

export type Unit = FunctionDoc | Claim | Definition;
export type UnitType = 'functions' | 'claims' | 'definitions';

export interface ParsedBlock {
  id: string;
  role: SpanRole;
  text: string;
  page?: number;
  start: number;
  end: number;
}

export interface ExtractionWindow {
  spans: Span[];
  context: string;
}

export interface ExtractionResult<T> {
  units: T[];
  errors: string[];
  tokenCount?: number;
  cost?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface Config {
  database: {
    url: string;
  };
  s3: {
    endpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
  claude: {
    apiKey: string;
  };
  confidence: {
    definitions: number;
    claims: number;
    functions: number;
  };
  maxQuoteChars: number;
}