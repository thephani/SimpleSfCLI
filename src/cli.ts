#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import config from './config.js';
import { SalesforceClient } from './SalesforceClient.js';
import { AuthService } from './services/AuthService.js';
import type { CommandArgsConfig } from './types/config.type.js';
import type { DeployOptions } from './types/deployment.type.js';

class CLI {
	private program: Command;
	private config: CommandArgsConfig;

	constructor() {
		this.program = new Command();
		this.config = config;
		this.setupProgram();
	}

	private setupProgram(): void {
		this.program.name('simpleSfCli').description('Salesforce CLI for metadata deployment').version(this.config.cliVersion);

		this.addGlobalOptions();
		this.setupCommands();
		this.program.parse(process.argv);
	}

	private addGlobalOptions(): void {
		this.program
			.option('-u, --username <username>', 'Salesforce username')
			.option('-c, --clientId <clientId>', 'Salesforce client ID')
			.option('-k, --privateKey <privateKey>', 'Salesforce private key')
			.option('-e, --env <environment>', 'Production or Sandbox [Default]', 'Sandbox')
			.option('-s, --source <sourceDir>', 'Path to the SFDX source directory')
			.option('-b, --baseBranch <baseBranch>', 'Base branch or git ref for delta comparison', this.config.baseBranch)
			.option('-r, --targetBranch <targetBranch>', 'Target branch or git ref for delta comparison', this.config.targetBranch)
			.option('-v, --validateOnly', 'Validate only, do not deploy')
			.option('-x, --exclude <types...>', 'List of metadata types to exclude')
			.option('-t, --testLevel <level>', 'Specifies which tests are run as part of a deployment', 'NoTestRun');
	}

	private setupCommands(): void {
		this.setupAuthTokenCommand();
		this.setupQuickDeployCommand();
		this.setupDeployCommand();
	}

	private setupAuthTokenCommand(): void {
		this.program
			.command('auth:token')
			.description('Authenticate and return a Salesforce access token')
			.option('-u, --username <username>', 'Salesforce username')
			.option('-c, --clientId <clientId>', 'Salesforce client ID')
			.option('-k, --privateKey <privateKey>', 'Salesforce private key')
			.option('-e, --env <environment>', 'Production or Sandbox [Default]')
			.option('--json', 'Print token details as JSON to stdout')
			.option('-o, --output <path>', 'Write token details to a JSON file with 0600 permissions')
			.action(async (cmdOptions) => {
				try {
					const options = { ...this.program.opts(), ...this.getCommandOptions(cmdOptions) };
					const updatedConfig = this.getUpdatedConfig(options, {
						logUsername: !options.json,
					});
					const authService = new AuthService(updatedConfig);
					const authResult = await authService.authenticate();
					const tokenDetails = {
						accessToken: authResult.accessToken,
						instanceUrl: authResult.instanceUrl,
						issuedAt: authResult.issuedAt,
						username: updatedConfig.username,
					};

					if (options.output) {
						await this.writeTokenFile(options.output, tokenDetails);
						if (!options.json) {
							console.log(`Token details written to ${options.output}`);
						}
					}

					if (options.json) {
						console.log(JSON.stringify(tokenDetails, null, 2));
					} else if (!options.output) {
						console.log('Authenticated successfully. Use --json to print token details or --output to write them to a file.');
					}
				} catch (error) {
					this.handleError('Authentication failed', error);
				}
			});
	}

	private setupQuickDeployCommand(): void {
		this.program
			.command('quick-deploy')
			.description('Quick deploy using a validated deployment ID')
			.option('-u, --username <username>', 'Salesforce username')
			.option('-c, --clientId <clientId>', 'Salesforce client ID')
			.option('-k, --privateKey <privateKey>', 'Salesforce private key')
			.option('-e, --env <environment>', 'Production or Sandbox [Default]')
			.requiredOption('-q, --quickDeployId <id>', 'Validated deployment ID')
			.action(async (cmdOptions) => {
				try {
					const options = { ...this.program.opts(), ...this.getCommandOptions(cmdOptions) };
					const updatedConfig = this.getUpdatedConfig(options);
					const client = new SalesforceClient(updatedConfig);
					console.log('Initiating quick deployment...');
					const result = await client.quickDeploy(options.quickDeployId);
					console.log('Quick deployment completed:', result);
				} catch (error) {
					this.handleError('Quick deployment failed', error);
				}
			});
	}

	private setupDeployCommand(): void {
		this.program
			.command('deploy', { isDefault: true })
			.description('Deploy metadata to Salesforce')
			.action(async () => {
				try {
					const updatedConfig = this.getUpdatedConfig(this.program.opts());
					const client = new SalesforceClient(updatedConfig);

					const deployOptions: DeployOptions = {
						checkOnly: Boolean(this.program.opts().validateOnly),
						testLevel: updatedConfig.testLevel,
						allowMissingFiles: false,
						rollbackOnError: true,
						singlePackage: true,
					};

					// Initialize deployment
					const result: any = await client.deploy(deployOptions);
					console.log('Deployment completed:', result.id);
				} catch (error) {
					this.handleError('Deployment failed', error);
				}
			});
	}

	private getCommandOptions(commandOrOptions: any): any {
		if (typeof commandOrOptions.opts === 'function') {
			return commandOrOptions.opts();
		}

		return commandOrOptions;
	}

	private getUpdatedConfig(options: any, logging: { logUsername?: boolean } = {}): CommandArgsConfig {
		const updatedConfig = { ...this.config, ...options };
		const { logUsername = true } = logging;
		updatedConfig.env = this.normalizeEnv(options.env ?? updatedConfig.env);

		// Update instance URL and test level for production environment
		if (updatedConfig.env === 'PRODUCTION') {
			updatedConfig.instanceUrl = 'https://login.salesforce.com';
			updatedConfig.testLevel = 'RunLocalTests';
		}

		// Validate required fields
		this.validateConfig(updatedConfig);

		if (logUsername) {
			console.log('Username :', updatedConfig.username);
		}
		// console.log('Using configuration:', updatedConfig);
		return updatedConfig;
	}

	private normalizeEnv(env: string): CommandArgsConfig['env'] {
		switch (env.toUpperCase()) {
			case 'PROD':
			case 'PRODUCTION':
				return 'PRODUCTION';
			case 'SBX':
			case 'SANDBOX':
				return 'SANDBOX';
			default:
				throw new Error(`Invalid environment: ${env}. Expected SANDBOX or PRODUCTION.`);
		}
	}

	private async writeTokenFile(outputPath: string, tokenDetails: object): Promise<void> {
		const resolvedPath = path.resolve(outputPath);

		await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
		await fs.promises.writeFile(
			resolvedPath,
			`${JSON.stringify(tokenDetails, null, 2)}\n`,
			{ encoding: 'utf-8', mode: 0o600 },
		);
		await fs.promises.chmod(resolvedPath, 0o600);
	}

	private validateConfig(config: CommandArgsConfig): void {
		const requiredFields: (keyof CommandArgsConfig)[] = ['username', 'clientId', 'privateKey'];
		const missingFields = requiredFields.filter((field) => !config[field]);

		if (missingFields.length > 0) {
			throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
		}
	}

	private handleError(message: string, error: unknown): never {
		console.error(message);
		if (error instanceof Error) {
			console.error('Error details:', error.message);
			console.error('Stack trace:', error.stack);
		} else {
			console.error('Unknown error:', error);
		}
		process.exit(1);
	}
}

// Initialize CLI
new CLI();
