import path from 'path';
import { Command } from 'commander';
import { defaults } from '../config';
import { ToonValidator } from '../core/services/ToonValidator';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate TOON files and hashes')
    .option('-t, --toon-root <toonRoot>', 'TOON repository root', defaults.toonRoot)
    .action(async (options: { toonRoot: string }) => {
      const validator = new ToonValidator();
      const summary = await validator.run(path.resolve(options.toonRoot));

      if (summary.valid) {
        console.log(`Validation passed (${summary.scannedFiles} TOON files)`);
        return;
      }

      console.error(`Validation failed (${summary.issues.length} issues):`);
      for (const issue of summary.issues) {
        console.error(`- ${issue.file}: ${issue.message}`);
      }
      process.exit(1);
    });
}
