#!/usr/bin/env node

import { Command } from 'commander';
import config from './config.js';
import { SalesforceClient } from './SalesforceClient.js';
import type { CommandArgsConfig } from './types/config.type.js';
import type { DeployOptions, ReportFormat } from './types/deployment.type.js';

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
			.requiredOption('-u, --username <username>', 'Salesforce username')
			.requiredOption('-c, --clientId <clientId>', 'Salesforce client ID')
			.requiredOption('-k, --privateKey <privateKey>', 'Salesforce private key')
			.option('-e, --env <environment>', 'Production or Sandbox [Default]', 'Sandbox')
			.option('-s, --source <sourceDir>', 'Path to the SFDX source directory')
			.option('-b, --baseBranch <baseBranch>', 'Base branch or git ref for delta comparison', this.config.baseBranch)
			.option('-r, --targetBranch <targetBranch>', 'Target branch or git ref for delta comparison', this.config.targetBranch)
			.option('-v, --validateOnly', 'Validate only, do not deploy')
			.option('-x, --exclude <types...>', 'List of metadata types to exclude')
			.option('-t, --testLevel <level>', 'Specifies which tests are run as part of a deployment', 'NoTestRun')
			.option('--reportFormat <json|junit|both>', 'Deployment report format', this.config.reportFormat ?? 'json')
			.option('--reportPath <path>', 'Directory path for generated deployment reports', this.config.reportPath ?? './reports');
	}

	private setupCommands(): void {
		this.setupQuickDeployCommand();
		this.setupDeployCommand();
	}

	private setupQuickDeployCommand(): void {
		this.program
			.command('quick-deploy')
			.description('Quick deploy using a validated deployment ID')
			.requiredOption('-q, --quickDeployId <id>', 'Validated deployment ID')
			.action(async (cmdOptions) => {
				try {
					const updatedConfig = this.getUpdatedConfig(cmdOptions);
					const client = new SalesforceClient(updatedConfig);
					console.log('Initiating quick deployment...');
					const result = await client.quickDeploy(cmdOptions.quickDeployId);
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

	private getUpdatedConfig(options: any): CommandArgsConfig {
		const updatedConfig = { ...this.config, ...options };
		updatedConfig.reportFormat = this.parseReportFormat(updatedConfig.reportFormat);

		// Update instance URL and test level for production environment
		if (options.env?.toUpperCase() === 'PRODUCTION') {
			updatedConfig.instanceUrl = 'https://login.salesforce.com';
			updatedConfig.testLevel = 'RunLocalTests';
		}

		// Validate required fields
		this.validateConfig(updatedConfig);

		console.log('Username :', updatedConfig.username);
		// console.log('Using configuration:', updatedConfig);
		return updatedConfig;
	}


	private parseReportFormat(value?: string): ReportFormat {
		const allowedFormats: ReportFormat[] = ['json', 'junit', 'both'];
		const normalizedValue = (value ?? 'json').toLowerCase() as ReportFormat;

		if (!allowedFormats.includes(normalizedValue)) {
			throw new Error(`Invalid report format: ${value}. Allowed values: ${allowedFormats.join(', ')}`);
		}

		return normalizedValue;
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
