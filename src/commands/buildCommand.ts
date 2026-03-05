import path from 'path';
import { Command } from 'commander';
import { defaults } from '../config';
import { BuildService } from '../core/services/BuildService';
import { PlanService } from '../core/services/PlanService';

export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Build MDAPI artifacts and deploy zip from a deployment plan')
    .option('-p, --plan <planPath>', 'Plan JSON path', defaults.planPath)
    .option('-b, --build-root <buildRoot>', 'Build output root', defaults.buildRoot)
    .option('-o, --out <outputZip>', 'Main deploy zip path', defaults.outputZip)
    .option('--destructive-out <destructiveZip>', 'Destructive changes zip path', `${defaults.buildRoot}/destructive.zip`)
    .action(async (options: { plan: string; buildRoot: string; out: string; destructiveOut: string }) => {
      const planService = new PlanService();
      const plan = await planService.read(path.resolve(options.plan));
      const buildService = new BuildService();

      const artifacts = await buildService.run({
        plan,
        buildRoot: path.resolve(options.buildRoot),
        mainZipPath: path.resolve(options.out),
        destructiveZipPath: path.resolve(options.destructiveOut),
      });

      console.log(`Build root: ${artifacts.buildRoot}`);
      if (artifacts.mainZipPath) {
        console.log(`Main deploy zip: ${artifacts.mainZipPath}`);
      } else {
        console.log('Main deploy zip: not generated (no add/modify components)');
      }

      if (artifacts.destructiveZipPath) {
        console.log(`Destructive zip: ${artifacts.destructiveZipPath}`);
      } else {
        console.log('Destructive zip: not generated (no delete components)');
      }
    });
}
