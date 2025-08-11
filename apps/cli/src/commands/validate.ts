import { Command } from 'commander';
import { loadConfig, validateFunction, validateClaim, validateDefinition, validateAllSpanIds } from '../../../../packages/core/src/index.ts';
import { Database } from '../../../../packages/db/src/index.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface DraftUnit {
  type: 'function' | 'claim' | 'definition';
  data: any;
}

export const validateCommand = new Command()
  .name('validate')
  .description('Validate extracted units')
  .argument('<documentId>', 'Document ID to validate')
  .option('--strict', 'Use strict validation rules')
  .action(async (documentId: string, options) => {
    try {
      const config = loadConfig();
      const db = new Database(config);
      
      console.log(`Validating units for document: ${documentId}`);
      
      // Load spans to validate span_ids
      const spans = await db.getSpans(documentId);
      if (spans.length === 0) {
        console.error('No spans found for document');
        process.exit(1);
      }
      
      const validSpanIds = new Set(spans.map(s => s.id));
      
      // Load draft files
      const draftFiles = [
        `derived/${documentId}/functions.jsonl`,
        `derived/${documentId}/claims.jsonl`,
        `derived/${documentId}/definitions.jsonl`
      ];
      
      let totalUnits = 0;
      let validUnits = 0;
      let totalErrors = 0;
      
      for (const draftFile of draftFiles) {
        const filePath = join(process.cwd(), 'temp', draftFile);
        
        if (!existsSync(filePath)) {
          console.log(`Skipping ${draftFile} (not found)`);
          continue;
        }
        
        console.log(`\nValidating ${draftFile}:`);
        
        const fileContent = readFileSync(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n').filter(line => line.trim());
        
        for (let i = 0; i < lines.length; i++) {
          const lineNum = i + 1;
          totalUnits++;
          
          try {
            const unit = JSON.parse(lines[i]);
            let validationResult;
            let unitType: string;
            
            // Determine unit type and validate
            if (draftFile.includes('functions')) {
              validationResult = validateFunction(unit, config);
              unitType = 'function';
            } else if (draftFile.includes('claims')) {
              validationResult = validateClaim(unit, config);
              unitType = 'claim';
            } else if (draftFile.includes('definitions')) {
              validationResult = validateDefinition(unit, config);
              unitType = 'definition';
            } else {
              console.warn(`  Line ${lineNum}: Unknown unit type`);
              continue;
            }
            
            // Validate span IDs exist
            const spanValidation = validateAllSpanIds(unit.span_ids || [], validSpanIds);
            
            const allErrors = [...validationResult.errors, ...spanValidation.errors];
            const isValid = validationResult.valid && spanValidation.valid;
            
            if (isValid) {
              validUnits++;
              if (!options.strict) {
                console.log(`  ✓ Line ${lineNum}: Valid ${unitType} "${unit.name || unit.term || unit.subject}"`);
              }
            } else {
              totalErrors += allErrors.length;
              console.error(`  ✗ Line ${lineNum}: Invalid ${unitType}`);
              
              allErrors.forEach(error => {
                console.error(`    ${error.field}: ${error.message}`);
                if (error.value !== undefined) {
                  console.error(`    Value: ${JSON.stringify(error.value)}`);
                }
              });
            }
            
          } catch (parseError) {
            totalErrors++;
            console.error(`  ✗ Line ${lineNum}: JSON parse error - ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
          }
        }
      }
      
      await db.close();
      
      console.log(`\n📊 Validation Summary:`);
      console.log(`  Total units: ${totalUnits}`);
      console.log(`  Valid units: ${validUnits}`);
      console.log(`  Invalid units: ${totalUnits - validUnits}`);
      console.log(`  Total errors: ${totalErrors}`);
      
      if (totalUnits > 0) {
        const successRate = (validUnits / totalUnits) * 100;
        console.log(`  Success rate: ${successRate.toFixed(1)}%`);
        
        if (validUnits === totalUnits) {
          console.log(`\n✅ All units passed validation!`);
        } else {
          console.log(`\n⚠️  ${totalUnits - validUnits} units failed validation`);
          if (options.strict) {
            process.exit(1);
          }
        }
      } else {
        console.log('\n⚠️  No units found to validate');
      }
      
    } catch (error) {
      console.error('Error during validation:', error);
      process.exit(1);
    }
  });