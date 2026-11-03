#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import config from './config.js';
import { SalesforceClient } from './SalesforceClient.js';
import { AuthService } from './services/AuthService.js';
import type { CommandArgsConfig } from './types/config.type.js';
import type { DeployOptions, DeployResult } from './types/deployment.type.js';

export class CLI {
	private program: Command;
	private config: CommandArgsConfig;

	constructor(autoParse: boolean = true) {
		this.program = new Command();
		this.config = config;
		this.setupProgram(autoParse);
	}

	private setupProgram(autoParse: boolean = true): void {
		this.program.name('simpleSfCli').description('Salesforce CLI for metadata deployment').version(this.config.cliVersion);

		this.addGlobalOptions();
		this.setupCommands();
		if (autoParse) {
			this.program.parse(process.argv);
		}
	}

	private addGlobalOptions(): void {
		this.program
			.option('-u, --username <username>', 'Salesforce username')
			.option('-c, --clientId <clientId>', 'Salesforce client ID')
			.option('-k, --privateKey <privateKey>', 'Salesforce private key')
			.option('-e, --env <environment>', 'Production or Sandbox [Default]')
			.option('-s, --source <sourceDir>', 'Path to the SFDX source directory')
			.option('-b, --baseBranch <baseBranch>', 'Base branch or git ref for delta comparison', this.config.baseBranch)
			.option('-r, --targetBranch <targetBranch>', 'Target branch or git ref for delta comparison', this.config.targetBranch)
			.option('-v, --validateOnly', 'Validate only, do not deploy')
			.option('--dry-run', 'Convert and package metadata without authenticating or deploying')
			.option('--dryRun', 'Convert and package metadata without authenticating or deploying')
			.option('--json', 'Output deployment result as structured JSON to stdout')
			.option('-x, --exclude <types...>', 'List of metadata types to exclude')
			.option('-t, --testLevel <level>', 'Specifies which tests are run as part of a deployment', 'NoTestRun')
			.option('--tests <tests...>', 'List of Apex tests to run when testLevel is RunSpecifiedTests')
			.option('--apiVersion <version>', 'Salesforce API version (e.g., 60.0 or v60.0)')
			.option('--pollInterval <ms>', 'Polling interval in milliseconds', (val) => parseInt(val, 10))
			.option('--maxPollAttempts <count>', 'Maximum number of status polling attempts', (val) => parseInt(val, 10));
	}

	private setupCommands(): void {
		this.setupAuthTokenCommand();
		this.setupQuickDeployCommand();
		this.setupPackageCommand();
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
				const timer = this.startCommandTimer();
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
					this.logCommandDuration(timer);
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
			.option('--json', 'Print deployment result as JSON to stdout')
			.option('--apiVersion <version>', 'Salesforce API version (e.g., 60.0 or v60.0)')
			.requiredOption('-q, --quickDeployId <id>', 'Validated deployment ID')
			.action(async (cmdOptions) => {
				const timer = this.startCommandTimer();
				try {
					const options = { ...this.program.opts(), ...this.getCommandOptions(cmdOptions) };
					const updatedConfig = this.getUpdatedConfig(options, {
						logUsername: !options.json,
					});
					const client = new SalesforceClient(updatedConfig);
					if (!options.json) {
						console.log('Initiating quick deployment...');
					}
					const result = await this.runWithQuietStdout(Boolean(options.json), () =>
						client.quickDeploy(options.quickDeployId),
					);
					this.writeStepSummary(result, false);
					if (options.json) {
						console.log(JSON.stringify(this.formatJsonResult(result, false), null, 2));
					} else {
						console.log('Quick deployment completed:', result);
					}
					this.logCommandDuration(timer);
				} catch (error) {
					this.handleError('Quick deployment failed', error);
				}
			});
	}

	private setupPackageCommand(): void {
		this.program
			.command('package')
			.description('Convert SFDX source to MDAPI format and generate deploy.zip without authenticating')
			.option('-s, --source <sourceDir>', 'Path to the SFDX source directory')
			.option('-b, --baseBranch <baseBranch>', 'Base branch or git ref for delta comparison')
			.option('-r, --targetBranch <targetBranch>', 'Target branch or git ref for delta comparison')
			.option('-x, --exclude <types...>', 'List of metadata types to exclude')
			.option('--apiVersion <version>', 'Salesforce API version (e.g., 60.0 or v60.0)')
			.action(async (cmdOptions) => {
				const timer = this.startCommandTimer();
				try {
					const options = { ...this.program.opts(), ...this.getCommandOptions(cmdOptions), dryRun: true };
					const updatedConfig = this.getUpdatedConfig(options, {
						requireAuth: false,
						logUsername: false,
					});
					const client = new SalesforceClient(updatedConfig);
					const { packaged, zipPath } = await client.package();
					if (packaged && zipPath) {
						console.log(`Package created at ${zipPath}`);
					}
					this.logCommandDuration(timer);
				} catch (error) {
					this.handleError('Packaging failed', error);
				}
			});
	}

	private setupDeployCommand(): void {
		this.program
			.command('deploy', { isDefault: true })
			.description('Deploy metadata to Salesforce')
			.option('--dry-run', 'Convert and package metadata without authenticating or deploying')
			.option('--dryRun', 'Convert and package metadata without authenticating or deploying')
			.option('--json', 'Output deployment result as structured JSON to stdout')
			.option('--tests <tests...>', 'List of Apex tests to run when testLevel is RunSpecifiedTests')
			.option('--apiVersion <version>', 'Salesforce API version (e.g., 60.0 or v60.0)')
			.option('--pollInterval <ms>', 'Polling interval in milliseconds', (val) => parseInt(val, 10))
			.option('--maxPollAttempts <count>', 'Maximum number of status polling attempts', (val) => parseInt(val, 10))
			.action(async (cmdOptions) => {
				const timer = this.startCommandTimer();
				try {
					const options = { ...this.program.opts(), ...this.getCommandOptions(cmdOptions) };
					const isDryRun = Boolean(options.dryRun);
					const isJson = Boolean(options.json);
					const checkOnly = Boolean(options.validateOnly);
					const updatedConfig = this.getUpdatedConfig(options, {
						requireAuth: !isDryRun,
						logUsername: !isDryRun && !isJson,
					});
					const client = new SalesforceClient(updatedConfig);

					if (isDryRun) {
						const { packaged, zipPath } = await this.runWithQuietStdout(isJson, () => client.package());
						if (isJson) {
							console.log(JSON.stringify({
								status: 'DryRun',
								id: null,
								done: true,
								checkOnly: true,
								packaged,
								zipPath,
							}, null, 2));
						} else if (packaged && zipPath) {
							console.log(`Dry run completed: package created at ${zipPath}`);
						}
						this.logCommandDuration(timer);
						return;
					}

					const deployOptions: DeployOptions = {
						checkOnly,
						testLevel: updatedConfig.testLevel,
						runTests: updatedConfig.runTests,
						allowMissingFiles: false,
						rollbackOnError: true,
						singlePackage: true,
					};

					// Initialize deployment
					const result = await this.runWithQuietStdout(isJson, () => client.deploy(deployOptions));
					if (result) {
						this.writeStepSummary(result, checkOnly);
						if (isJson) {
							console.log(JSON.stringify(this.formatJsonResult(result, checkOnly), null, 2));
						} else {
							console.log('Deployment completed:', result.id);
						}
					} else if (isJson) {
						console.log(JSON.stringify({
							status: 'NoChanges',
							id: null,
							done: true,
							checkOnly,
							numberComponentsDeployed: 0,
							numberComponentsTotal: 0,
							numberTestsCompleted: 0,
							numberTestsTotal: 0,
							details: { componentFailures: [] },
						}, null, 2));
					}
					this.logCommandDuration(timer);
				} catch (error) {
					this.handleError('Deployment failed', error);
				}
			});
	}

	private async runWithQuietStdout<T>(quiet: boolean, fn: () => Promise<T>): Promise<T> {
		if (!quiet) {
			return fn();
		}
		const originalLog = console.log;
		const originalTable = console.table;
		console.log = (...args: unknown[]) => console.error(...args);
		console.table = (...args: unknown[]) => console.error(...args);
		try {
			return await fn();
		} finally {
			console.log = originalLog;
			console.table = originalTable;
		}
	}

	private formatJsonResult(result: DeployResult, checkOnly: boolean) {
		return {
			status: result.status,
			id: result.id,
			done: result.done,
			checkOnly: (result as any).checkOnly ?? checkOnly,
			numberComponentsDeployed: result.numberComponentsDeployed ?? 0,
			numberComponentsTotal: result.numberComponentsTotal ?? 0,
			numberTestsCompleted: result.numberTestsCompleted ?? 0,
			numberTestsTotal: result.numberTestsTotal ?? 0,
			details: result.details ?? { componentFailures: [] },
		};
	}

	private writeStepSummary(result: DeployResult, checkOnly: boolean): void {
		const summaryPath = process.env.GITHUB_STEP_SUMMARY;
		if (!summaryPath) {
			return;
		}
		try {
			const mode = checkOnly ? 'Validation' : 'Deployment';
			const lines = [
				`### Salesforce ${mode} Summary`,
				'',
				`| Metric | Value |`,
				`| :--- | :--- |`,
				`| **Status** | \`${result.status}\` |`,
				`| **Deployment ID** | \`${result.id}\` |`,
				`| **Check Only** | \`${(result as any).checkOnly ?? checkOnly}\` |`,
				`| **Components Deployed** | ${result.numberComponentsDeployed ?? 0} / ${result.numberComponentsTotal ?? 0} |`,
				`| **Tests Completed** | ${result.numberTestsCompleted ?? 0} / ${result.numberTestsTotal ?? 0} |`,
				'',
			];
			fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf-8');
		} catch {
			// Ignore step summary write errors
		}
	}

	private getCommandOptions(commandOrOptions: any): any {
		if (!commandOrOptions) {
			return {};
		}
		if (typeof commandOrOptions.opts === 'function') {
			return commandOrOptions.opts();
		}

		return commandOrOptions;
	}

	private startCommandTimer(): bigint {
		return process.hrtime.bigint();
	}

	private logCommandDuration(startedAt: bigint): void {
		const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
		console.error(`⏱️ Command completed in ${elapsedSeconds.toFixed(2)} seconds.`);
	}

	private getUpdatedConfig(
		options: any,
		settings: { logUsername?: boolean; requireAuth?: boolean } = {},
	): CommandArgsConfig {
		const sfdxDefaults = this.readSfdxProjectDefaults();
		const updatedConfig: CommandArgsConfig = {
			...this.config,
			runTests: [...(this.config.runTests ?? [])],
		};

		if (sfdxDefaults.source) {
			updatedConfig.source = sfdxDefaults.source;
		}
		if (sfdxDefaults.apiVersion) {
			updatedConfig.sfVersion = this.normalizeApiVersion(sfdxDefaults.apiVersion);
			updatedConfig.apiVersion = updatedConfig.sfVersion;
		}

		// Apply CLI options and environment variable fallbacks
		updatedConfig.username = options.username ?? process.env.SF_USERNAME ?? updatedConfig.username;
		updatedConfig.clientId = options.clientId ?? process.env.SF_CLIENT_ID ?? updatedConfig.clientId;
		updatedConfig.privateKey =
			options.privateKey ??
			process.env.SF_PRIVATE_KEY ??
			process.env.SF_PRIVATE_KEY_PATH ??
			updatedConfig.privateKey;
		updatedConfig.source = options.source ?? process.env.SF_SOURCE ?? updatedConfig.source;

		if (options.baseBranch !== undefined) {
			updatedConfig.baseBranch = options.baseBranch;
		}
		if (options.targetBranch !== undefined) {
			updatedConfig.targetBranch = options.targetBranch;
		}
		if (options.testLevel !== undefined) {
			updatedConfig.testLevel = options.testLevel;
		}
		if (options.output !== undefined) {
			updatedConfig.output = options.output;
		}
		if (options.quickDeployId !== undefined) {
			updatedConfig.quickDeployId = options.quickDeployId;
		}
		if (options.dryRun !== undefined) {
			updatedConfig.dryRun = Boolean(options.dryRun);
		}
		if (options.json !== undefined) {
			updatedConfig.json = Boolean(options.json);
		}

		const rawExclude = options.exclude ?? (process.env.SF_EXCLUDE ? [process.env.SF_EXCLUDE] : undefined);
		if (rawExclude) {
			const excludeList = Array.isArray(rawExclude) ? rawExclude : [String(rawExclude)];
			updatedConfig.exclude = excludeList
				.flatMap((value: string) => value.split(','))
				.map((value: string) => value.trim())
				.filter(Boolean);
		}

		if (options.tests) {
			const testsList = Array.isArray(options.tests) ? options.tests : [String(options.tests)];
			const parsedTests = testsList
				.flatMap((value: string) => value.split(','))
				.map((value: string) => value.trim())
				.filter(Boolean);
			updatedConfig.tests = parsedTests;
			updatedConfig.runTests = [...new Set([...(updatedConfig.runTests ?? []), ...parsedTests])];
		}

		if (options.apiVersion) {
			updatedConfig.sfVersion = this.normalizeApiVersion(options.apiVersion);
			updatedConfig.apiVersion = updatedConfig.sfVersion;
		}

		if (options.pollInterval !== undefined && !Number.isNaN(Number(options.pollInterval))) {
			updatedConfig.pollInterval = Number(options.pollInterval);
		}

		if (options.maxPollAttempts !== undefined && !Number.isNaN(Number(options.maxPollAttempts))) {
			updatedConfig.maxPollAttempts = Number(options.maxPollAttempts);
		}

		const { logUsername = true, requireAuth = true } = settings;
		const rawEnv = options.env ?? process.env.SF_ENV ?? updatedConfig.env ?? 'SANDBOX';
		updatedConfig.env = this.normalizeEnv(rawEnv);

		// Update instance URL and test level for production environment
		if (updatedConfig.env === 'PRODUCTION') {
			updatedConfig.instanceUrl = 'https://login.salesforce.com';
			updatedConfig.testLevel = 'RunLocalTests';
		}

		// Validate required fields when authentication is required
		if (requireAuth && !updatedConfig.dryRun) {
			this.validateConfig(updatedConfig);
		}

		if (logUsername && updatedConfig.username) {
			console.log('Username :', updatedConfig.username);
		}
		return updatedConfig;
	}

	private normalizeApiVersion(version: string): string {
		const trimmed = String(version).trim();
		if (!trimmed) {
			return this.config.sfVersion;
		}
		return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
	}

	private readSfdxProjectDefaults(): { source?: string; apiVersion?: string } {
		try {
			const projectPath = path.join(process.cwd(), 'sfdx-project.json');
			if (typeof fs.existsSync !== 'function' || !fs.existsSync(projectPath)) {
				return {};
			}
			const rawContent = fs.readFileSync(projectPath, 'utf-8');
			const parsed = JSON.parse(rawContent) as {
				packageDirectories?: Array<{ path?: string; default?: boolean }>;
				sourceApiVersion?: string;
			};

			const result: { source?: string; apiVersion?: string } = {};
			if (Array.isArray(parsed.packageDirectories) && parsed.packageDirectories.length > 0) {
				const defaultPkg =
					parsed.packageDirectories.find((pkg) => pkg.default && pkg.path) ??
					parsed.packageDirectories.find((pkg) => Boolean(pkg.path));
				if (defaultPkg?.path) {
					const candidatePath = defaultPkg.path.replace(/\\/g, '/').replace(/\/+$/, '');
					const metadataRootCandidate = `${candidatePath}/main/default`;
					const resolvedMetadataRoot = path.resolve(process.cwd(), metadataRootCandidate);
					const resolvedCandidate = path.resolve(process.cwd(), candidatePath);
					if (fs.existsSync(resolvedMetadataRoot) || fs.existsSync(metadataRootCandidate)) {
						result.source = metadataRootCandidate;
					} else if (fs.existsSync(resolvedCandidate) || fs.existsSync(candidatePath)) {
						result.source = candidatePath;
					}
				}
			}

			if (typeof parsed.sourceApiVersion === 'string' && parsed.sourceApiVersion.trim()) {
				result.apiVersion = parsed.sourceApiVersion.trim();
			}

			return result;
		} catch {
			return {};
		}
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

// Initialize CLI unless explicitly skipped by unit tests
if (!process.env.JEST_SKIP_CLI_AUTO_RUN) {
	new CLI();
}

