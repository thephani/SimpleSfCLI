import path from 'path';
import { Command } from 'commander';
import { defaults, defaultInstanceUrl } from '../config';
import { DeployWorkflowService } from '../core/services/DeployWorkflowService';
import { DeployAuthConfig, DeployOptions } from '../core/types/deploy';

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Plan, build, and deploy TOON changes to Salesforce')
    .requiredOption('-u, --username <username>', 'Salesforce username')
    .requiredOption('-c, --client-id <clientId>', 'Connected App client ID')
    .requiredOption('-k, --private-key <privateKey>', 'Path to JWT private key')
    .option('-e, --env <env>', 'Target environment SANDBOX|PRODUCTION', defaults.env)
    .option('--instance-url <instanceUrl>', 'Salesforce login URL override')
    .option('--sf-version <sfVersion>', 'Salesforce API version', defaults.sfVersion)
    .option('--test-level <testLevel>', 'NoTestRun|RunSpecifiedTests|RunLocalTests|RunAllTestsInOrg', defaults.testLevel)
    .option('--run-tests <tests>', 'Comma-separated test class list for RunSpecifiedTests')
    .option('--validate-only', 'Validate only (checkOnly=true)', false)
    .option('-t, --toon-root <toonRoot>', 'TOON repository root', defaults.toonRoot)
    .option('--from-ref <fromRef>', 'Git reference start', defaults.fromRef)
    .option('--to-ref <toRef>', 'Git reference end', defaults.toRef)
    .option('-p, --plan <planPath>', 'Output plan path', defaults.planPath)
    .option('-b, --build-root <buildRoot>', 'Build output root', defaults.buildRoot)
    .option('-o, --out <outputZip>', 'Main deploy zip path', defaults.outputZip)
    .action(async (options: DeployCommandOptions) => {
      const normalizedEnv = options.env.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
      const auth: DeployAuthConfig = {
        username: options.username,
        clientId: options.clientId,
        privateKey: path.resolve(options.privateKey),
        env: normalizedEnv,
        instanceUrl: options.instanceUrl || defaultInstanceUrl(normalizedEnv),
        sfVersion: options.sfVersion,
      };

      const deployOptions: Partial<DeployOptions> = {
        allowMissingFiles: false,
        checkOnly: Boolean(options.validateOnly),
        rollbackOnError: true,
        singlePackage: true,
        testLevel: options.testLevel,
      };

      if (options.runTests) {
        deployOptions.runTests = options.runTests.split(',').map((item) => item.trim()).filter(Boolean);
      }

      const workflow = new DeployWorkflowService();
      const result = await workflow.run({
        toonRoot: options.toonRoot,
        fromRef: options.fromRef,
        toRef: options.toRef,
        planPath: path.resolve(options.plan),
        buildRoot: path.resolve(options.buildRoot),
        outputZip: path.resolve(options.out),
        auth,
        deployOptions,
      });

      console.log(`Plan: adds=${result.plan.adds.length}, modifies=${result.plan.modifies.length}, deletes=${result.plan.deletes.length}`);

      if (!result.mainResult && !result.destructiveResult) {
        console.log('No deployment required: no package/destructive artifacts generated.');
        return;
      }

      if (result.mainResult) {
        console.log(`Main deployment status: ${result.mainResult.status}`);
        if (result.mainResult.status !== 'Succeeded' && result.mainResult.status !== 'SucceededPartial') {
          console.error('Main deployment failed.');
          process.exit(1);
        }
      }

      if (result.destructiveResult) {
        console.log(`Destructive deployment status: ${result.destructiveResult.status}`);
        if (result.destructiveResult.status !== 'Succeeded' && result.destructiveResult.status !== 'SucceededPartial') {
          console.error('Destructive deployment failed.');
          process.exit(1);
        }
      }
    });
}

interface DeployCommandOptions {
  username: string;
  clientId: string;
  privateKey: string;
  env: string;
  instanceUrl?: string;
  sfVersion: string;
  testLevel: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';
  runTests?: string;
  validateOnly: boolean;
  toonRoot: string;
  fromRef: string;
  toRef: string;
  plan: string;
  buildRoot: string;
  out: string;
}
