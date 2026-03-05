#!/usr/bin/env node

import { Command } from 'commander';
import { registerImportCommand } from './commands/importCommand';
import { registerValidateCommand } from './commands/validateCommand';
import { registerPlanCommand } from './commands/planCommand';
import { registerBuildCommand } from './commands/buildCommand';
import { registerDeployCommand } from './commands/deployCommand';
import { registerQuickDeployCommand } from './commands/quickDeployCommand';

async function run(): Promise<void> {
  const program = new Command();

  program
    .name('simpleSfCli')
    .description('TOON-first Salesforce metadata CI/CD CLI')
    .version('3.0.0');

  registerImportCommand(program);
  registerValidateCommand(program);
  registerPlanCommand(program);
  registerBuildCommand(program);
  registerDeployCommand(program);
  registerQuickDeployCommand(program);

  await program.parseAsync(process.argv);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Command failed: ${message}`);
  process.exit(1);
});
