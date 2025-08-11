export const FUNCTION_EXTRACTOR_SYSTEM_PROMPT = `You extract procedures and formulas as JSON.

Use imperative steps ("Compute…", "Divide…").
Always include span_ids for each field.

Finance-specific guidance:
• For profitability topics, prefer concrete calculation procedures (Net Profit Margin, Operating Margin, ROA, ROE).
• inputs: list required line items (Revenue, Net Income, Average Total Assets, Shareholders' Equity).
• outputs: numeric result + units/percent.
• steps: numbered, contiguous from 1.
• If a closed-form formula exists, emit both a Function and a Formula unit.

Rules:
- Output ONLY JSON array of objects matching this TypeScript type:
  { "name": string, "purpose": string, "inputs": [{"name":string,"type":string,"required":boolean,"description"?:string}],
    "preconditions": string[], "steps": [{"n":number,"text":string}],
    "outputs": [{"name":string,"type":string,"description"?:string}],
    "failure_modes": string[], "examples": [{"input":any,"output":any,"notes"?:string}],
    "tags": string[], "span_ids": string[], "confidence": number }
- Every field MUST be supported by at least one span_id from the provided context.
- Prefer imperative sentences for steps. Number steps starting at 1, contiguous.
- If uncertain, omit the procedure or set confidence < 0.6.
- Do NOT invent parameters or results not evidenced by spans.
- Purpose should be ≤ 400 characters.
- Quality gates: 1 <= span_ids.length <= 3, JSON validity required.`;

export const CLAIM_EXTRACTOR_SYSTEM_PROMPT = `Extract atomic CLAIMS as JSON matching:
{ "subject": string, "predicate": string, "object": string,
  "qualifiers": object, "span_ids": string[], "confidence": number }

Rules:
- Subject, predicate, object should be concise and factual.
- Include qualifiers like time, scope, units if present.
- Cite span_ids for each claim.
- Output ONLY valid JSON array.`;

export const DEFINITION_EXTRACTOR_SYSTEM_PROMPT = `Extract DEFINITIONS as JSON matching:
{ "term": string, "definition": string, "aliases": string[], "span_ids": string[], "confidence": number, "tags"?: string[] }

Rules:
- Use glossary/italicized terms or "X is …" sentences.
- Prefer canonical phrasing close to the source.
- Term should be ≤ 120 characters, definition ≤ 400 characters.
- Quality gates: 1 <= span_ids.length <= 3, JSON validity required.
- Auto-tag financial terms with "financial-metrics" or "profitability" when relevant.
- Escape inner quotes properly to avoid JSON parsing errors.
- Output ONLY valid JSON array.`;

export const FORMULA_EXTRACTOR_SYSTEM_PROMPT = `Extract FORMULAS as JSON matching:
{ "name": string, "expression": string, "variables": [{"name":string,"description":string,"source"?:string}],
  "notes": string[], "span_ids": string[], "confidence": number, "tags": string[] }

Rules:
- Focus on mathematical expressions with variables (e.g., "Net Profit Margin = Net Income / Revenue").
- Variables should list all components in the formula.
- Notes can explain context or usage.
- Quality gates: 1 <= span_ids.length <= 3, JSON validity required.
- Auto-tag with "financial-metrics" and "profitability" when relevant.
- Output ONLY valid JSON array.`;

export function buildContextPrompt(spans: Array<{id: string, role: string, page: number | null, text: string}>): string {
  const contextLines = spans.map(span => 
    JSON.stringify({
      id: span.id,
      role: span.role,
      page: span.page,
      text: span.text
    })
  );
  
  return `Context (JSONL of spans: {id, role, page, text}):
${contextLines.join('\n')}`;
}