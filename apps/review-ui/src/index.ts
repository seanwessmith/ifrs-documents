import index from './index.html';
import { loadConfig } from '@ifrs/core';
import { Database } from '@ifrs/db';

const config = loadConfig();

export default Bun.serve({
  port: 3001,
  routes: {
    '/': index,
    
    // API routes for the review UI
    '/api/documents': {
      GET: async () => {
        const db = new Database(config);
        try {
          const documents = await db.sql`
            SELECT id, title, authors, created_at
            FROM documents 
            ORDER BY created_at DESC
          `;
          await db.close();
          
          return Response.json(documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            authors: doc.authors,
            createdAt: doc.created_at
          })));
        } catch (error) {
          await db.close();
          return Response.json({ error: 'Failed to fetch documents' }, { status: 500 });
        }
      }
    },
    
    '/api/units/:documentId': {
      GET: async (req) => {
        const url = new URL(req.url);
        const unitType = url.searchParams.get('type') || 'all';
        const documentId = req.params.documentId;
        
        const db = new Database(config);
        try {
          let units = [];
          
          if (unitType === 'all' || unitType === 'functions') {
            const functions = await db.sql`
              SELECT id, name, purpose, inputs, confidence, 'function' as type
              FROM functions 
              WHERE document_id = ${documentId}
            `;
            units.push(...functions);
          }
          
          if (unitType === 'all' || unitType === 'claims') {
            const claims = await db.sql`
              SELECT id, subject, predicate, object, confidence, 'claim' as type
              FROM claims 
              WHERE document_id = ${documentId}
            `;
            units.push(...claims);
          }
          
          if (unitType === 'all' || unitType === 'definitions') {
            const definitions = await db.sql`
              SELECT id, term, definition, aliases, confidence, 'definition' as type
              FROM definitions 
              WHERE document_id = ${documentId}
            `;
            units.push(...definitions);
          }
          
          await db.close();
          return Response.json(units);
          
        } catch (error) {
          await db.close();
          return Response.json({ error: 'Failed to fetch units' }, { status: 500 });
        }
      }
    }
  },
  
  development: {
    hmr: true,
    console: true,
  }
});

console.log('🚀 Review UI running at http://localhost:3001');