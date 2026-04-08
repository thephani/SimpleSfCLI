// src/SalesforceClient.ts
import type { CommandArgsConfig } from './types/config.type.js';
import { AuthService } from './services/AuthService.js';
import { DeployService } from './services/DeployService.js';
import { MDAPIService } from './services/MDAPIService.js';
import { ArchiverService } from './services/ArchiverService.js';
import { ReportService } from './services/ReportService.js';
import type { DeployOptions, DeployResult } from 'types/deployment.type.js';
import path from 'path';
import fs from 'fs';

export class SalesforceClient {
	private config: CommandArgsConfig;
	private authService: AuthService;
	private deployService: DeployService;
	private mdapiService: MDAPIService;
	private archiverService: ArchiverService;
	private reportService: ReportService;

	constructor(config: CommandArgsConfig) {
		this.config = config;
		this.authService = new AuthService(config);
		this.deployService = new DeployService(config);
		this.mdapiService = new MDAPIService(config);
		this.archiverService = new ArchiverService(config);
		this.reportService = new ReportService();
	}

	async deploy(options: Partial<DeployOptions> = {}): Promise<DeployResult> {
		try {
			// Step 1: Authentication
			console.log('🔐 Authenticating with Salesforce...');
			await this.authService.authenticate();

			const runTests = await this.mdapiService.convertToMDAPI(this.config.exclude);
			const files = await fs.promises.readdir(this.config.cliOuputFolder);
			const hasPackageXml = files.some((file) => file === 'package.xml');

			const deploymentOptions = { ...options, runTests };
			let mainDeployId: string;

			if (hasPackageXml) {
				console.log('📦 Preparing deployment package...', this.config.output);
				await this.archiverService.zipDirectory(this.config.cliOuputFolder, this.config.output);

				console.log('🚀 Initiating deployment...');
				mainDeployId = await this.deployService.initiateDeployment(this.config.output, deploymentOptions);
				console.log('📝 Main deployment initiated with ID:', mainDeployId);

				console.log('⏳ Waiting for deployment completion...');
				console.time('⏳⏳ Deployment time ⏳⏳');
				const mainDeployResult = await this.deployService.pollDeploymentStatus(mainDeployId);
				console.log('📊 Main deployment result:', mainDeployResult.status);
				console.timeEnd('⏳⏳ Deployment time ⏳⏳');
				await this.generateReport(mainDeployResult);

				return mainDeployResult;
			}

			const destructivePath = path.join(this.config.cliOuputFolder, 'destructiveChanges', 'destructiveChanges.xml');
			let destructiveDeployId: string | undefined;

			if (this.fileExists(destructivePath)) {
				console.log('🗑️  Destructive changes found, preparing destructive changes deployment...');

				try {
					const destructiveZipPath = path.join(this.config.cliOuputFolder, 'destructive-package.zip');
					await this.archiverService.zipDirectory(path.join(this.config.cliOuputFolder, 'destructiveChanges'), destructiveZipPath);

					destructiveDeployId = await this.deployService.initiateDeployment(destructiveZipPath, deploymentOptions);
					console.log('🚀 Destructive changes deployment initiated with ID:', destructiveDeployId);
				} catch (error) {
					console.error('❌ Error processing destructive changes:', error);
				}
			} else {
				console.log('ℹ️  No destructive changes found');
			}

			if (destructiveDeployId) {
				console.log('⏳ Waiting for destructive changes deployment...');
				try {
					const destructiveResult = await this.deployService.pollDeploymentStatus(destructiveDeployId);
					await this.generateReport(destructiveResult);
					return destructiveResult;
				} catch (error) {
					console.error('❌ Error in destructive changes deployment:', error);
				}
			}
			throw new Error('Deployment failed: Missing required condition.');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('❌ Deployment failed:', errorMessage);
			throw new Error(`Deployment failed: ${errorMessage}`);
		}
	}

	private async generateReport(deployResult: DeployResult): Promise<void> {
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
			}
		);
	}

	private fileExists(filePath: string): boolean {
		return fs.existsSync(filePath);
	}

	async quickDeploy(deploymentId: string): Promise<DeployResult> {
		await this.authService.authenticate();
		return this.deployService.quickDeploy(deploymentId);
	}
}
