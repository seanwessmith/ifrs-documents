import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config, Document, Span, Definition, Claim, FunctionDoc, Formula } from '../../core/src/index.ts';

export class Database {
  private sql: postgres.Sql;
  
  constructor(config: Config) {
    this.sql = postgres(config.database.url, {
      types: {
        bigint: postgres.BigInt,
      },
    });
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  async migrate(): Promise<void> {
    const migrationPath = join(process.cwd(), 'infra/sql/0001_init.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    await this.sql.unsafe(migration);
  }

  async insertDocument(doc: Omit<Document, 'id' | 'createdAt'>): Promise<string> {
    const [result] = await this.sql`
      INSERT INTO documents (uri, title, authors, type, checksum, page_count)
      VALUES (${doc.uri}, ${doc.title}, ${doc.authors}, ${doc.type}, ${doc.checksum}, ${doc.pageCount})
      RETURNING id
    `;
    return result.id;
  }

  async getDocument(id: string): Promise<Document | null> {
    const [result] = await this.sql`
      SELECT * FROM documents WHERE id = ${id}
    `;
    if (!result) return null;
    
    return {
      id: result.id,
      uri: result.uri,
      title: result.title,
      authors: result.authors,
      type: result.type,
      checksum: result.checksum,
      pageCount: result.page_count,
      createdAt: result.created_at,
    };
  }

  async getDocumentByUri(uri: string): Promise<Document | null> {
    const [result] = await this.sql`
      SELECT * FROM documents WHERE uri = ${uri}
    `;
    if (!result) return null;
    
    return {
      id: result.id,
      uri: result.uri,
      title: result.title,
      authors: result.authors,
      type: result.type,
      checksum: result.checksum,
      pageCount: result.page_count,
      createdAt: result.created_at,
    };
  }

  async updateDocument(id: string, doc: Omit<Document, 'id' | 'createdAt'>): Promise<void> {
    await this.sql`
      UPDATE documents 
      SET title = ${doc.title}, 
          authors = ${doc.authors}, 
          type = ${doc.type}, 
          checksum = ${doc.checksum}, 
          page_count = ${doc.pageCount}
      WHERE id = ${id}
    `;
  }

  async deleteSpansForDocument(documentId: string): Promise<void> {
    await this.sql`
      DELETE FROM spans WHERE document_id = ${documentId}
    `;
  }

  async insertSpans(spans: Omit<Span, 'id'>[]): Promise<void> {
    // Insert spans one by one to avoid escapeIdentifier issues
    for (const span of spans) {
      await this.sql`
        INSERT INTO spans (document_id, page, start_offset, end_offset, role, text, checksum)
        VALUES (${span.documentId}, ${span.page}, ${span.start}, ${span.end}, ${span.role}, ${span.text}, ${span.checksum})
      `;
    }
  }

  async getSpans(documentId: string): Promise<Span[]> {
    const results = await this.sql`
      SELECT * FROM spans WHERE document_id = ${documentId} ORDER BY start_offset
    `;
    
    return results.map(row => ({
      id: row.id,
      documentId: row.document_id,
      page: row.page,
      start: row.start_offset,
      end: row.end_offset,
      role: row.role,
      text: row.text,
      checksum: row.checksum,
    }));
  }

  async insertDefinitions(defs: Omit<Definition, 'id'>[]): Promise<void> {
    // Insert definitions one by one to avoid escapeIdentifier issues
    for (const def of defs) {
      await this.sql`
        INSERT INTO definitions (
          document_id, term, definition, aliases, span_ids, confidence, embedding, term_slug, aliases_norm, tags
        )
        VALUES (
          ${def.documentId},
          ${def.term},
          ${def.definition},
          ${def.aliases},
          ${def.span_ids},
          ${def.confidence},
          null,
          ${def.term_slug || null},
          ${def.aliases_norm || null},
          ${def.tags || null}
        )
      `;
    }
  }

  async updateDefinitionEmbeddings(updates: Array<{ id: string; embedding: number[] }>): Promise<void> {
    for (const update of updates) {
      const vectorStr = '[' + update.embedding.join(',') + ']';
      await this.sql`
        UPDATE definitions 
        SET embedding = ${vectorStr}::vector
        WHERE id = ${update.id}
      `;
    }
  }

  async insertClaims(claims: Omit<Claim, 'id'>[]): Promise<void> {
    // Insert claims one by one to avoid escapeIdentifier issues
    for (const claim of claims) {
      await this.sql`
        INSERT INTO claims (
          document_id, subject, predicate, object, qualifiers, span_ids, confidence, embedding
        )
        VALUES (
          ${claim.documentId},
          ${claim.subject},
          ${claim.predicate},
          ${claim.object},
          ${JSON.stringify(claim.qualifiers)}::jsonb,
          ${claim.span_ids},
          ${claim.confidence},
          null
        )
      `;
    }
  }

  async updateClaimEmbeddings(updates: Array<{ id: string; embedding: number[] }>): Promise<void> {
    for (const update of updates) {
      const vectorStr = '[' + update.embedding.join(',') + ']';
      await this.sql`
        UPDATE claims 
        SET embedding = ${vectorStr}::vector
        WHERE id = ${update.id}
      `;
    }
  }

  async insertFunctions(funcs: Omit<FunctionDoc, 'id'>[]): Promise<void> {
    // Insert functions one by one to avoid escapeIdentifier issues
    for (const func of funcs) {
      await this.sql`
        INSERT INTO functions (
          document_id, name, purpose, inputs, preconditions, steps,
          outputs, failure_modes, examples, tags, span_ids, confidence, embedding
        )
        VALUES (
          ${func.documentId},
          ${func.name},
          ${func.purpose},
          ${JSON.stringify(func.inputs)}::jsonb,
          ${JSON.stringify(func.preconditions)}::jsonb,
          ${JSON.stringify(func.steps)}::jsonb,
          ${JSON.stringify(func.outputs)}::jsonb,
          ${JSON.stringify(func.failure_modes)}::jsonb,
          ${JSON.stringify(func.examples)}::jsonb,
          ${func.tags},
          ${func.span_ids},
          ${func.confidence},
          null
        )
      `;
    }
  }

  async updateFunctionEmbeddings(updates: Array<{ id: string; embedding: number[] }>): Promise<void> {
    for (const update of updates) {
      const vectorStr = '[' + update.embedding.join(',') + ']';
      await this.sql`
        UPDATE functions 
        SET embedding = ${vectorStr}::vector
        WHERE id = ${update.id}
      `;
    }
  }

  async insertFormulas(formulas: Omit<Formula, 'id'>[]): Promise<void> {
    for (const formula of formulas) {
      await this.sql`
        INSERT INTO formulas (
          document_id, name, expression, variables, notes, tags, span_ids, confidence, embedding
        )
        VALUES (
          ${formula.documentId},
          ${formula.name},
          ${formula.expression},
          ${JSON.stringify(formula.variables)}::jsonb,
          ${JSON.stringify(formula.notes)}::jsonb,
          ${formula.tags},
          ${formula.span_ids},
          ${formula.confidence},
          null
        )
      `;
    }
  }

  async updateFormulaEmbeddings(updates: Array<{ id: string; embedding: number[] }>): Promise<void> {
    for (const update of updates) {
      const vectorStr = '[' + update.embedding.join(',') + ']';
      await this.sql`
        UPDATE formulas 
        SET embedding = ${vectorStr}::vector
        WHERE id = ${update.id}
      `;
    }
  }

  async getUnitsForEmbedding(documentId: string): Promise<{
    functions: Array<{ id: string; text: string }>;
    claims: Array<{ id: string; text: string }>;
    definitions: Array<{ id: string; text: string }>;
  }> {
    const [functions, claims, definitions] = await Promise.all([
      this.sql`
        SELECT id, name, purpose 
        FROM functions 
        WHERE document_id = ${documentId} AND embedding IS NULL
      `,
      this.sql`
        SELECT id, subject, predicate, object 
        FROM claims 
        WHERE document_id = ${documentId} AND embedding IS NULL
      `,
      this.sql`
        SELECT id, term, definition 
        FROM definitions 
        WHERE document_id = ${documentId} AND embedding IS NULL
      `
    ]);

    return {
      functions: functions.map(f => ({
        id: f.id,
        text: `${f.name}: ${f.purpose}`
      })),
      claims: claims.map(c => ({
        id: c.id,
        text: `${c.subject} ${c.predicate} ${c.object}`
      })),
      definitions: definitions.map(d => ({
        id: d.id,
        text: `${d.term}: ${d.definition}`
      }))
    };
  }

  async searchFunctions(query: string, limit: number = 10): Promise<FunctionDoc[]> {
    const results = await this.sql`
      SELECT * FROM functions
      WHERE to_tsvector('english', name || ' ' || purpose) @@ plainto_tsquery('english', ${query})
      ORDER BY confidence DESC
      LIMIT ${limit}
    `;

    return results.map(row => ({
      id: row.id,
      documentId: row.document_id,
      name: row.name,
      purpose: row.purpose,
      inputs: row.inputs,
      preconditions: row.preconditions,
      steps: row.steps,
      outputs: row.outputs,
      failure_modes: row.failure_modes,
      examples: row.examples,
      tags: row.tags,
      span_ids: row.span_ids,
      confidence: row.confidence,
    }));
  }

  async searchFunctionsByVector(queryEmbedding: number[], limit: number = 10): Promise<FunctionDoc[]> {
    const vectorStr = '[' + queryEmbedding.join(',') + ']';
    const results = await this.sql`
      SELECT *, (embedding <-> ${vectorStr}::vector) as distance
      FROM functions 
      WHERE embedding IS NOT NULL
      ORDER BY embedding <-> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    return results.map(row => ({
      id: row.id,
      documentId: row.document_id,
      name: row.name,
      purpose: row.purpose,
      inputs: row.inputs,
      preconditions: row.preconditions,
      steps: row.steps,
      outputs: row.outputs,
      failure_modes: row.failure_modes,
      examples: row.examples,
      tags: row.tags,
      span_ids: row.span_ids,
      confidence: row.confidence,
      distance: row.distance,
    }));
  }

  async searchClaimsByVector(queryEmbedding: number[], limit: number = 10): Promise<Claim[]> {
    const vectorStr = '[' + queryEmbedding.join(',') + ']';
    const results = await this.sql`
      SELECT *, (embedding <-> ${vectorStr}::vector) as distance
      FROM claims 
      WHERE embedding IS NOT NULL
      ORDER BY embedding <-> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    return results.map(row => ({
      id: row.id,
      documentId: row.document_id,
      subject: row.subject,
      predicate: row.predicate,
      object: row.object,
      qualifiers: row.qualifiers,
      span_ids: row.span_ids,
      confidence: row.confidence,
      distance: row.distance,
    }));
  }

  async searchDefinitionsByVector(queryEmbedding: number[], limit: number = 10): Promise<Definition[]> {
    const vectorStr = '[' + queryEmbedding.join(',') + ']';
    const results = await this.sql`
      SELECT *, (embedding <-> ${vectorStr}::vector) as distance
      FROM definitions 
      WHERE embedding IS NOT NULL
      ORDER BY embedding <-> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    return results.map(row => ({
      id: row.id,
      documentId: row.document_id,
      term: row.term,
      definition: row.definition,
      aliases: row.aliases,
      span_ids: row.span_ids,
      confidence: row.confidence,
      distance: row.distance,
    }));
  }

  async hybridSearchFunctions(
    query: string, 
    queryEmbedding?: number[], 
    limit: number = 10
  ): Promise<FunctionDoc[]> {
    if (!queryEmbedding) {
      return this.searchFunctions(query, limit);
    }

    // Get both FTS and vector results
    const [ftsResults, vectorResults] = await Promise.all([
      this.searchFunctions(query, limit),
      this.searchFunctionsByVector(queryEmbedding, limit)
    ]);

    // Simple hybrid scoring: combine and deduplicate
    const resultMap = new Map<string, any>();
    
    // Add FTS results with boost
    ftsResults.forEach((result, index) => {
      resultMap.set(result.id, {
        ...result,
        hybridScore: (limit - index) * 2 + result.confidence // FTS boost + confidence
      });
    });

    // Add vector results
    vectorResults.forEach((result, index) => {
      const existing = resultMap.get(result.id);
      if (existing) {
        // Boost if found in both
        existing.hybridScore += (limit - index) * 1.5;
      } else {
        resultMap.set(result.id, {
          ...result,
          hybridScore: (limit - index) + result.confidence
        });
      }
    });

    // Sort by hybrid score and return top results
    return Array.from(resultMap.values())
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);
  }

  async searchClaims(query: string, limit: number = 10): Promise<Claim[]> {
    const results = await this.sql`
      SELECT * FROM claims
      WHERE to_tsvector('english', subject || ' ' || predicate || ' ' || object) @@ plainto_tsquery('english', ${query})
      ORDER BY confidence DESC
      LIMIT ${limit}
    `;

    return results.map(row => ({
      id: row.id,
      documentId: row.document_id,
      subject: row.subject,
      predicate: row.predicate,
      object: row.object,
      qualifiers: row.qualifiers,
      span_ids: row.span_ids,
      confidence: row.confidence,
    }));
  }

  async getDocumentTitle(id: string): Promise<string | null> {
    const [result] = await this.sql`
      SELECT title FROM documents WHERE id = ${id}
    `;
    return result?.title || null;
  }

  async validateSpanIds(spanIds: string[]): Promise<boolean> {
    const [result] = await this.sql`
      SELECT COUNT(*) as count FROM spans WHERE id = ANY(${spanIds})
    `;
    return result.count === spanIds.length;
  }

  async getSpanCitations(spanIds: string[]): Promise<Array<{span_id: string, title: string, page: number}>> {
    if (spanIds.length === 0) return [];
    
    const results = await this.sql`
      SELECT s.id AS span_id, d.title, COALESCE(s.page, 0) AS page
      FROM spans s
      JOIN documents d ON d.id = s.document_id
      WHERE s.id = ANY(${spanIds})
      ORDER BY d.title, s.page
    `;
    
    return results.map(row => ({
      span_id: row.span_id,
      title: row.title,
      page: row.page
    }));
  }
}