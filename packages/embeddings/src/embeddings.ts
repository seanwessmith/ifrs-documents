import type { Config } from '../../core/src/index.ts';

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export class ClaudeEmbeddings implements EmbeddingProvider {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Note: Claude doesn't provide embeddings directly
    // This is a placeholder - you would use a different service like OpenAI
    // or run a local model like sentence-transformers
    throw new Error('Claude embeddings not implemented - use OpenAI or local model');
  }

  getDimensions(): number {
    return 1024; // Placeholder dimension
  }
}

export class OpenAIEmbeddings implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  
  constructor(apiKey: string, model: string = 'text-embedding-3-small', dimensions: number = 1024) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions, // OpenAI v3 models support custom dimensions
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  getDimensions(): number {
    return this.dimensions;
  }
}

// Placeholder for local embeddings using sentence-transformers
export class LocalEmbeddings implements EmbeddingProvider {
  private modelName: string;
  
  constructor(modelName: string = 'all-MiniLM-L6-v2') {
    this.modelName = modelName;
  }

  async embed(texts: string[]): Promise<number[][]> {
    // This would use a Python subprocess or ONNX runtime
    // For now, return random embeddings as placeholder
    return texts.map(() => 
      Array.from({ length: 384 }, () => Math.random() - 0.5)
    );
  }

  getDimensions(): number {
    return 384; // all-MiniLM-L6-v2 dimension
  }
}

export function createEmbeddingProvider(config: Config): EmbeddingProvider {
  const embeddingType = process.env.EMBEDDING_TYPE || 'openai'; // Default to OpenAI for working embeddings
  
  switch (embeddingType) {
    case 'openai':
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        throw new Error('OPENAI_API_KEY is required for OpenAI embeddings');
      }
      // Use text-embedding-3-small with 1024 dimensions to match database
      return new OpenAIEmbeddings(openaiKey, 'text-embedding-3-small', 1024);
    
    case 'claude':
      return new ClaudeEmbeddings(config.claude.apiKey);
    
    case 'local':
    default:
      return new LocalEmbeddings();
  }
}

export async function generateEmbeddings(
  texts: string[], 
  provider: EmbeddingProvider,
  batchSize: number = 100
): Promise<number[][]> {
  const results: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`  Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    
    const embeddings = await provider.embed(batch);
    results.push(...embeddings);
    
    // Rate limiting
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}