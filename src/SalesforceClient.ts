// src/SalesforceClient.ts
import type { CommandArgsConfig } from './types/config.type.js';
import { AuthService } from './services/AuthService.js';
import { DeployService } from './services/DeployService.js';
import { MDAPIService } from './services/MDAPIService.js';
import { ArchiverService } from './services/ArchiverService.js';
import { DeployOptions, DeployResult } from 'types/deployment.type.js';
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

	async deploy(options: Partial<DeployOptions> = {}): Promise<DeployResult | null> {
		console.log('🔐 Authenticating with Salesforce...');
		await this.authService.authenticate();
		const runTests = await this.mdapiService.convertToMDAPI(this.config.exclude);
		const files = await fs.promises.readdir(this.config.cliOuputFolder);
		if (!files.includes('package.xml')) {
			console.log('No deployable metadata changes found.');
			return null;
		}
		await this.archiverService.zipDirectory(this.config.cliOuputFolder, this.config.output);
		const deploymentId = await this.deployService.initiateDeployment(this.config.output, { ...options, runTests });
		console.log('Deployment initiated with ID:', deploymentId);
		return this.deployService.pollDeploymentStatus(deploymentId);
	}

	async quickDeploy(deploymentId: string): Promise<DeployResult> {
		await this.authService.authenticate();
		return this.deployService.quickDeploy(deploymentId);
	}
}
