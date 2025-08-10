#!/usr/bin/env bun

import { Command } from 'commander';
import { ingestCommand } from './commands/ingest.js';
import { extractCommand } from './commands/extract.js';
import { validateCommand } from './commands/validate.js';
import { loadCommand } from './commands/load.js';
import { askCommand } from './commands/ask.js';
import { reviewCommand } from './commands/review.js';

const program = new Command();

program
  .name('ifrs')
  .description('Ingestion → Function Reference System')
  .version('0.1.0');

program
  .addCommand(ingestCommand)
  .addCommand(extractCommand)
  .addCommand(validateCommand)
  .addCommand(loadCommand)
  .addCommand(askCommand)
  .addCommand(reviewCommand);

program.parse();