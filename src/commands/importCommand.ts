import path from 'path';
import { Command } from 'commander';
import { defaults } from '../config';
import { ToonImporter } from '../core/services/ToonImporter';

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Convert SFDX metadata to TOON format')
    .option('-s, --source <sourceRoot>', 'SFDX source root', defaults.sourceRoot)
    .option('-t, --toon-root <toonRoot>', 'TOON repository root', defaults.toonRoot)
    .option('--clean', 'Legacy flag (no-op). Import never deletes existing TOON files', false)
    .action(async (options: { source: string; toonRoot: string; clean: boolean }) => {
      const importer = new ToonImporter();
      const summary = await importer.run({
        sourceRoot: path.resolve(options.source),
        toonRoot: path.resolve(options.toonRoot),
        clean: Boolean(options.clean),
      });

      console.log(`Imported components: ${summary.importedCount}`);
      console.log(`Skipped files: ${summary.skippedCount}`);
    });
}
