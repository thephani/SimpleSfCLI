import type { CommandArgsConfig } from './types/config.type.js';
import { AuthService } from './services/AuthService.js';
import { DeployService } from './services/DeployService.js';
import { DeploymentFailedError } from './errors/DeploymentFailedError.js';
import type { NormalizedDeployResponse } from './services/DeployService.js';
import { MDAPIService } from './services/MDAPIService.js';
import { ArchiverService } from './services/ArchiverService.js';
import { ReportService } from './services/ReportService.js';
import { RetrieveService } from './services/RetrieveService.js';
import type { DeployOptions, DeployResult } from './types/deployment.type.js';
import type { RetrieveCommandOptions, RetrieveStatusResult } from './types/retrieve.type.js';
import fs from 'fs';

export class SalesforceClient {
	private config: CommandArgsConfig;
	private authService: AuthService;
	private deployService: DeployService;
	private mdapiService: MDAPIService;
	private archiverService: ArchiverService;
	private reportService: ReportService;
	private retrieveService: RetrieveService;

	constructor(config: CommandArgsConfig) {
		this.config = config;
		this.authService = new AuthService(config);
		this.deployService = new DeployService(config);
		this.mdapiService = new MDAPIService(config);
		this.archiverService = new ArchiverService(config);
		this.reportService = new ReportService();
		this.retrieveService = new RetrieveService(config);
	}

	async package(): Promise<{ packaged: boolean; zipPath: string | null; runTests: string[] }> {
		const detectedTests = await this.mdapiService.convertToMDAPI(this.config.exclude);
		const configuredTests = this.config.tests ?? this.config.runTests ?? [];
		const runTests = [...new Set([...detectedTests, ...configuredTests])];
		const files = await fs.promises.readdir(this.config.cliOuputFolder);
		if (!files.includes('package.xml')) {
			console.log('No deployable metadata changes found.');
			return { packaged: false, zipPath: null, runTests };
		}
		await this.archiverService.zipDirectory(this.config.cliOuputFolder, this.config.output);
		return { packaged: true, zipPath: this.config.output, runTests };
	}

	async deploy(options: Partial<DeployOptions> = {}): Promise<DeployResult | null> {
		if (this.config.dryRun) {
			await this.package();
			return null;
		}
		console.log('🔐 Authenticating with Salesforce...');
		await this.authService.authenticate();
		const { packaged, runTests: packagedTests } = await this.package();
		if (!packaged) {
			return null;
		}
		const runTests = [...new Set([...packagedTests, ...(options.runTests ?? [])])];
		const deploymentId = await this.deployService.initiateDeployment(this.config.output, { ...options, runTests });
		console.log('Deployment initiated with ID:', deploymentId);
		return this.withReport(() => this.deployService.pollDeploymentStatus(deploymentId));
	}

	async quickDeploy(deploymentId: string): Promise<DeployResult> {
		await this.authService.authenticate();
		// DeployService.quickDeploy already polls until the quick deploy reaches a terminal state.
		return this.withReport(() => this.deployService.quickDeploy(deploymentId));
	}

	async fetchDeploymentStatus(deploymentId: string): Promise<DeployResult> {
		await this.authService.authenticate();
		return this.deployService.fetchDeploymentStatus(deploymentId);
	}

	async cancelDeployment(deploymentId: string): Promise<DeployResult> {
		await this.authService.authenticate();
		return this.deployService.cancelDeployment(deploymentId);
	}

	formatDeployResponse(result: DeployResult): NormalizedDeployResponse {
		return this.deployService.formatDeployResponse(result);
	}

	async retrieve(options: RetrieveCommandOptions): Promise<{ id: string; status: string; outputDir: string }> {
		if (options.targetLayout && options.targetLayout !== 'mdapi') {
			throw new Error(`Unsupported target layout: ${options.targetLayout}. Only mdapi is currently supported.`);
		}

		await this.authService.authenticate();
		const retrieveId = await this.retrieveService.initiateRetrieve(options);
		const retrieveResult: RetrieveStatusResult = await this.retrieveService.pollRetrieveStatus(retrieveId);

		if (retrieveResult.status !== 'Succeeded' || !retrieveResult.zipFile) {
			throw new Error(retrieveResult.errorMessage || `Retrieve failed with status: ${retrieveResult.status}`);
		}

		await this.archiverService.extractBase64Zip(retrieveResult.zipFile, options.outputDir);
		return { id: retrieveResult.id, status: retrieveResult.status, outputDir: options.outputDir };
	}

	/**
	 * Runs a deployment-producing operation and writes the configured report for
	 * both successful and failed terminal results before propagating the outcome.
	 */
	private async withReport(operation: () => Promise<DeployResult>): Promise<DeployResult> {
		try {
			const result = await operation();
			await this.generateReport(result);
			return result;
		} catch (error) {
			if (error instanceof DeploymentFailedError) {
				await this.generateReport(error.result);
			}
			throw error;
		}
	}

	private async generateReport(deployResult: DeployResult): Promise<void> {
		if (!this.config.reportFormat) {
			return;
		}
		try {
			await this.reportService.writeDeploymentReport(
				{
					summary: this.deployService.serializeSummary(deployResult),
					componentFailures: this.deployService.serializeComponentFailures(deployResult),
					testFailures: this.deployService.serializeTestFailures(deployResult),
				},
				{
					reportFormat: this.config.reportFormat,
					reportPath: this.config.reportPath,
					emitConsoleSummary: true,
				},
			);
		} catch (error) {
			const reportError = error instanceof Error ? error.message : error;
			console.warn('⚠️ Failed to generate deployment report:', reportError);
		}
	}
}
