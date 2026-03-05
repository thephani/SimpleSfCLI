import { Command } from 'commander';
import path from 'path';
import { defaults, defaultInstanceUrl } from '../config';
import { DeployAuthConfig } from '../core/types/deploy';
import { AuthService } from '../services/AuthService';
import { MetadataDeployService } from '../services/MetadataDeployService';

export function registerQuickDeployCommand(program: Command): void {
  program
    .command('quick-deploy')
    .description('Quick deploy by validated deployment request ID')
    .requiredOption('-q, --quick-deploy-id <id>', 'Validated deployment request ID')
    .requiredOption('-u, --username <username>', 'Salesforce username')
    .requiredOption('-c, --client-id <clientId>', 'Connected App client ID')
    .requiredOption('-k, --private-key <privateKey>', 'Path to JWT private key')
    .option('-e, --env <env>', 'Target environment SANDBOX|PRODUCTION', defaults.env)
    .option('--instance-url <instanceUrl>', 'Salesforce login URL override')
    .option('--sf-version <sfVersion>', 'Salesforce API version', defaults.sfVersion)
    .action(async (options: QuickDeployCommandOptions) => {
      const normalizedEnv = options.env.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
      const authConfig: DeployAuthConfig = {
        username: options.username,
        clientId: options.clientId,
        privateKey: path.resolve(options.privateKey),
        env: normalizedEnv,
        instanceUrl: options.instanceUrl || defaultInstanceUrl(normalizedEnv),
        sfVersion: options.sfVersion,
      };

      const authService = new AuthService(authConfig);
      await authService.authenticate();

      const deployService = new MetadataDeployService(authConfig);
      const result = await deployService.quickDeploy(options.quickDeployId);

      console.log(`Quick deploy status: ${result.status}`);
      if (result.status !== 'Succeeded' && result.status !== 'SucceededPartial') {
        process.exit(1);
      }
    });
}

interface QuickDeployCommandOptions {
  quickDeployId: string;
  username: string;
  clientId: string;
  privateKey: string;
  env: string;
  instanceUrl?: string;
  sfVersion: string;
}
