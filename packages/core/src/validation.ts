import type { FunctionDoc, Claim, Definition, ValidationResult, ValidationError, Config } from './types.js';

export function validateFunction(func: FunctionDoc, config: Config): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required fields
  if (!func.name?.trim()) {
    errors.push({ field: 'name', message: 'Function name is required' });
  }

  if (!func.purpose?.trim()) {
    errors.push({ field: 'purpose', message: 'Function purpose is required' });
  } else if (func.purpose.length > 400) {
    errors.push({ field: 'purpose', message: 'Purpose must be ≤ 400 characters', value: func.purpose.length });
  }

  // Validate steps numbering
  if (!func.steps || func.steps.length === 0) {
    errors.push({ field: 'steps', message: 'At least one step is required' });
  } else {
    const stepNumbers = func.steps.map(s => s.n).sort((a, b) => a - b);
    const expectedNumbers = Array.from({ length: stepNumbers.length }, (_, i) => i + 1);
    
    if (!arraysEqual(stepNumbers, expectedNumbers)) {
      errors.push({ 
        field: 'steps', 
        message: 'Step numbers must be consecutive starting from 1',
        value: stepNumbers 
      });
    }

    // Check for empty step text
    func.steps.forEach((step, index) => {
      if (!step.text?.trim()) {
        errors.push({ 
          field: `steps[${index}].text`, 
          message: 'Step text cannot be empty' 
        });
      }
    });
  }

  // Validate span_ids
  if (!func.span_ids || func.span_ids.length === 0) {
    errors.push({ field: 'span_ids', message: 'At least one span_id is required for citations' });
  }

  // Check confidence threshold
  if (func.confidence < config.confidence.functions) {
    errors.push({ 
      field: 'confidence', 
      message: `Confidence ${func.confidence} below threshold ${config.confidence.functions}`,
      value: func.confidence 
    });
  }

  // Check for excessive quotes
  const fields = [func.name, func.purpose, ...func.preconditions, ...func.failure_modes];
  fields.forEach((field, index) => {
    if (field && hasExcessiveQuotes(field, config.maxQuoteChars)) {
      errors.push({
        field: `field[${index}]`,
        message: `Text contains quotes longer than ${config.maxQuoteChars} characters`,
        value: field.length
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateClaim(claim: Claim, config: Config): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required fields
  if (!claim.subject?.trim()) {
    errors.push({ field: 'subject', message: 'Claim subject is required' });
  }

  if (!claim.predicate?.trim()) {
    errors.push({ field: 'predicate', message: 'Claim predicate is required' });
  }

  if (!claim.object?.trim()) {
    errors.push({ field: 'object', message: 'Claim object is required' });
  }

  // Validate span_ids
  if (!claim.span_ids || claim.span_ids.length === 0) {
    errors.push({ field: 'span_ids', message: 'At least one span_id is required for citations' });
  }

  // Check confidence threshold
  if (claim.confidence < config.confidence.claims) {
    errors.push({ 
      field: 'confidence', 
      message: `Confidence ${claim.confidence} below threshold ${config.confidence.claims}`,
      value: claim.confidence 
    });
  }

  // Check for excessive quotes
  const fields = [claim.subject, claim.predicate, claim.object];
  fields.forEach((field, index) => {
    const fieldNames = ['subject', 'predicate', 'object'];
    if (hasExcessiveQuotes(field, config.maxQuoteChars)) {
      errors.push({
        field: fieldNames[index],
        message: `Text contains quotes longer than ${config.maxQuoteChars} characters`,
        value: field.length
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateDefinition(def: Definition, config: Config): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required fields
  if (!def.term?.trim()) {
    errors.push({ field: 'term', message: 'Definition term is required' });
  } else if (def.term.length > 120) {
    errors.push({ field: 'term', message: 'Term must be ≤ 120 characters', value: def.term.length });
  }

  if (!def.definition?.trim()) {
    errors.push({ field: 'definition', message: 'Definition text is required' });
  }

  // Validate span_ids
  if (!def.span_ids || def.span_ids.length === 0) {
    errors.push({ field: 'span_ids', message: 'At least one span_id is required for citations' });
  }

  // Check confidence threshold
  if (def.confidence < config.confidence.definitions) {
    errors.push({ 
      field: 'confidence', 
      message: `Confidence ${def.confidence} below threshold ${config.confidence.definitions}`,
      value: def.confidence 
    });
  }

  // Check for excessive quotes
  const fields = [def.term, def.definition, ...def.aliases];
  fields.forEach((field, index) => {
    if (field && hasExcessiveQuotes(field, config.maxQuoteChars)) {
      const fieldName = index === 0 ? 'term' : index === 1 ? 'definition' : `aliases[${index - 2}]`;
      errors.push({
        field: fieldName,
        message: `Text contains quotes longer than ${config.maxQuoteChars} characters`,
        value: field.length
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((val, index) => val === b[index]);
}

function hasExcessiveQuotes(text: string, maxQuoteChars: number): boolean {
  const quotes = text.match(/"[^"]*"/g) || [];
  return quotes.some(quote => quote.length > maxQuoteChars);
}

export function validateAllSpanIds(spanIds: string[], validSpanIds: Set<string>): ValidationResult {
  const errors: ValidationError[] = [];
  const invalidIds = spanIds.filter(id => !validSpanIds.has(id));
  
  if (invalidIds.length > 0) {
    errors.push({
      field: 'span_ids',
      message: `Invalid span IDs: ${invalidIds.join(', ')}`,
      value: invalidIds
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}