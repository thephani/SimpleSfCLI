#!/usr/bin/env node

import { Command } from 'commander';
import config from './config.js';
import { SalesforceClient } from './SalesforceClient.js';
import type { CommandArgsConfig } from './types/config.type.js';
import type { DeployOptions } from './types/deployment.type.js';
import type { NormalizedDeployResponse } from './services/DeployService.js';

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
			.option('--reportFormat <format>', 'Output format (summary|json)', 'summary');
	}

	private setupCommands(): void {
		this.setupQuickDeployCommand();
		this.setupDeployCommand();
		this.setupStatusCommand();
		this.setupCancelCommand();
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
					this.printReport(client.formatDeployResponse(result), updatedConfig.reportFormat);
					this.failForTerminalError(result.status, 'Quick deployment failed');
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
					this.printReport(client.formatDeployResponse(result), updatedConfig.reportFormat);
					this.failForTerminalError(result.status, 'Deployment failed');
				} catch (error) {
					this.handleError('Deployment failed', error);
				}
			});
	}

	private setupStatusCommand(): void {
		this.program
			.command('status')
			.description('Get one-shot deployment status')
			.requiredOption('--deployId <id>', 'Deployment ID')
			.action(async (cmdOptions) => {
				try {
					const updatedConfig = this.getUpdatedConfig({ ...this.program.opts(), ...cmdOptions });
					const client = new SalesforceClient(updatedConfig);
					const result = await client.fetchDeploymentStatus(cmdOptions.deployId);
					this.printReport(client.formatDeployResponse(result), updatedConfig.reportFormat);
					this.failForTerminalError(result.status, 'Deployment status indicates terminal failure');
				} catch (error) {
					this.handleError('Status command failed', error);
				}
			});
	}

	private setupCancelCommand(): void {
		this.program
			.command('cancel')
			.description('Cancel deployment by ID')
			.requiredOption('--deployId <id>', 'Deployment ID')
			.action(async (cmdOptions) => {
				try {
					const updatedConfig = this.getUpdatedConfig({ ...this.program.opts(), ...cmdOptions });
					const client = new SalesforceClient(updatedConfig);
					const result = await client.cancelDeployment(cmdOptions.deployId);
					this.printReport(client.formatDeployResponse(result), updatedConfig.reportFormat);
					this.failForTerminalError(result.status, 'Deployment cancel command failed');
				} catch (error) {
					this.handleError('Cancel command failed', error);
				}
			});
	}

	private getUpdatedConfig(options: any): CommandArgsConfig {
		const updatedConfig = { ...this.config, ...options };

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

	private printReport(report: NormalizedDeployResponse, reportFormat?: string): void {
		if (reportFormat?.toLowerCase() === 'json') {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		console.log(report.summary);
	}

	private failForTerminalError(status: string, message: string): void {
		if (status === 'Failed' || status === 'Canceled') {
			throw new Error(`${message}: ${status}`);
		}
	}
}

// Initialize CLI
new CLI();
