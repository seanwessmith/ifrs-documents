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
  definition: z.string(),
  aliases: z.array(z.string()),
  span_ids: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const FunctionExtractionResponseSchema = z.array(FunctionDocSchema);
export const ClaimExtractionResponseSchema = z.array(ClaimSchema);
export const DefinitionExtractionResponseSchema = z.array(DefinitionSchema);

export type FunctionDocDraft = z.infer<typeof FunctionDocSchema>;
export type ClaimDraft = z.infer<typeof ClaimSchema>;
export type DefinitionDraft = z.infer<typeof DefinitionSchema>;