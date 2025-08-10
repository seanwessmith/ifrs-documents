#!/usr/bin/env bun

import { Command } from 'commander';

const program = new Command();

program
  .name('ifrs')
  .description('Ingestion → Function Reference System')
  .version('0.1.0');

program
  .command('test')
  .description('Test command')
  .action(() => {
    console.log('✓ CLI is working!');
  });

program.parse();