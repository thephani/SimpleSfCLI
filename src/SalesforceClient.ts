// src/SalesforceClient.ts
import type { CommandArgsConfig } from './types/config.type.js';
import { AuthService } from './services/AuthService.js';
import { DeployService } from './services/DeployService.js';
import { MDAPIService } from './services/MDAPIService.js';
import { ArchiverService } from './services/ArchiverService.js';
import { DeployOptions, DeployResult } from 'types/deployment.type.js';
import path from 'path';
import fs from 'fs';

export class SalesforceClient {
	private config: CommandArgsConfig;
	private authService: AuthService;
	private deployService: DeployService;
	private mdapiService: MDAPIService;
	private archiverService: ArchiverService;

	constructor(config: CommandArgsConfig) {
		this.config = config;
		this.authService = new AuthService(config);
		this.deployService = new DeployService(config);
		this.mdapiService = new MDAPIService(config);
		this.archiverService = new ArchiverService(config);
	}

	async deploy(options: Partial<DeployOptions> = {}): Promise<DeployResult> {
		try {
			// Step 1: Authentication
			console.log('🔐 Authenticating with Salesforce...');
			await this.authService.authenticate();

			// Step 2: Convert to MDAPI format
			console.log('🔄 Converting to MDAPI format...');
			const runTests = await this.mdapiService.convertToMDAPI(this.config.exclude);

			// Step 3: Handle main deployment
			console.log('📦 Preparing main deployment package...');
			await this.archiverService.zipDirectory(this.config.cliOuputFolder, this.config.output);

			const deploymentOptions = { ...options, runTests };
			console.log('🚀 Initiating deployment...');
			const mainDeployId = await this.deployService.initiateDeployment(this.config.output, deploymentOptions);
			console.log('📝 Main deployment initiated with ID:', mainDeployId);

			// Step 4: Handle destructive changes
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
					// Continue with main deployment even if destructive deployment fails
				}
			} else {
				console.log('ℹ️  No destructive changes found');
			}

			// Step 5: Poll for deployment status
			console.log('⏳ Waiting for deployment completion...');
			console.time('⏳⏳ Deployment time ⏳⏳');
			const mainDeployResult = await this.deployService.pollDeploymentStatus(mainDeployId);
			console.timeEnd('⏳⏳ Deployment time ⏳⏳');
			if(mainDeployResult.status === 'Failed') process.exit(1);

			// If there was a destructive deployment, wait for it too
			if (destructiveDeployId) {
				console.log('⏳ Waiting for destructive changes deployment...');
				try {
					const destructiveResult = await this.deployService.pollDeploymentStatus(destructiveDeployId);
					console.log('📊 Destructive changes deployment result:', destructiveResult.status);
				} catch (error) {
					console.error('❌ Error in destructive changes deployment:', error);
				}
			}

			return mainDeployResult;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('❌ Deployment failed:', errorMessage);
			throw new Error(`Deployment failed: ${errorMessage}`);
		}
	}

	// Helper method to check file existence
	private fileExists(filePath: string): boolean {
		return fs.existsSync(filePath);
	}

	async quickDeploy(deploymentId: string): Promise<DeployResult> {
		await this.authService.authenticate();
		return this.deployService.quickDeploy(deploymentId);
	}
}
