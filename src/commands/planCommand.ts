import path from 'path';
import { Command } from 'commander';
import { defaults } from '../config';
import { PlanService } from '../core/services/PlanService';
import { WORKTREE_REF } from '../core/utils/git';

export function registerPlanCommand(program: Command): void {
  program
    .command('plan')
    .description('Generate deployment plan from git diff on TOON files')
    .option('-t, --toon-root <toonRoot>', 'TOON repository root', defaults.toonRoot)
    .option('--from-ref <fromRef>', 'Git reference start', defaults.fromRef)
    .option('--to-ref <toRef>', 'Git reference end', defaults.toRef)
    .option('--working-tree', 'Diff HEAD against current working tree (includes uncommitted changes)', false)
    .option('-o, --out <planPath>', 'Output plan JSON path', defaults.planPath)
    .action(async (options: { toonRoot: string; fromRef: string; toRef: string; out: string; workingTree: boolean }) => {
      const fromRef = options.workingTree ? 'HEAD' : options.fromRef;
      const toRef = options.workingTree ? WORKTREE_REF : options.toRef;
      const planService = new PlanService();
      const plan = await planService.generate({
        toonRoot: options.toonRoot,
        fromRef,
        toRef,
      });

      const outPath = path.resolve(options.out);
      await planService.write(outPath, plan);

      console.log(`Plan generated: ${outPath}`);
      console.log(`Adds: ${plan.adds.length}`);
      console.log(`Modifies: ${plan.modifies.length}`);
      console.log(`Deletes: ${plan.deletes.length}`);
    });
}
