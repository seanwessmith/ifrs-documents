import { z } from 'zod';

export const FunctionInputSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
  description: z.string().optional(),
});

export const FunctionOutputSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
});

export const FunctionStepSchema = z.object({
  n: z.number().int().positive(),
  text: z.string(),
});

export const FunctionExampleSchema = z.object({
  input: z.any(),
  output: z.any(),
  notes: z.string().optional(),
});

export const FunctionDocSchema = z.object({
  name: z.string(),
  purpose: z.string().max(400),
  inputs: z.array(FunctionInputSchema),
  preconditions: z.array(z.string()),
  steps: z.array(FunctionStepSchema),
  outputs: z.array(FunctionOutputSchema),
  failure_modes: z.array(z.string()),
  examples: z.array(FunctionExampleSchema),
  tags: z.array(z.string()),
  span_ids: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const ClaimSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  qualifiers: z.record(z.unknown()),
  span_ids: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const DefinitionSchema = z.object({
  term: z.string().max(120),
  definition: z.string().max(400),
  aliases: z.array(z.string()),
  span_ids: z.array(z.string()).min(1).max(3),
  confidence: z.number().min(0).max(1),
  term_slug: z.string().optional(),
  aliases_norm: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const FunctionExtractionResponseSchema = z.array(FunctionDocSchema);
export const ClaimExtractionResponseSchema = z.array(ClaimSchema);
export const FormulaVariableSchema = z.object({
  name: z.string(),
  description: z.string(),
  source: z.string().optional(),
});

export const FormulaSchema = z.object({
  name: z.string(),
  expression: z.string(),
  variables: z.array(FormulaVariableSchema),
  notes: z.array(z.string()),
  span_ids: z.array(z.string()).min(1).max(3),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
});

export const DefinitionExtractionResponseSchema = z.array(DefinitionSchema);
export const FormulaExtractionResponseSchema = z.array(FormulaSchema);

export type FunctionDocDraft = z.infer<typeof FunctionDocSchema>;
export type ClaimDraft = z.infer<typeof ClaimSchema>;
export type DefinitionDraft = z.infer<typeof DefinitionSchema>;
export type FormulaDraft = z.infer<typeof FormulaSchema>;