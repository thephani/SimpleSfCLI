// src/SalesforceClient.ts
import type { CommandArgsConfig } from './types/config.js';
import { AuthService } from './services/AuthService.js';
import { DeployService } from './services/DeployService.js';
import { MDAPIService } from './services/MDAPIService.js';
import { ArchiverService } from './services/ArchiverService.js';
import { DeployOptions, DeployResult } from 'types/deployment.js';

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
		await this.authService.authenticate();

		const runTests = await this.mdapiService.convertToMDAPI(this.config.source, this.config.cliOuputFolder, this.config.exclude);

		await this.archiverService.zipDirectory(this.config.cliOuputFolder, this.config.output);

		console.log('Initiating deployment...', runTests);

		const deployId = await this.deployService.initiateDeployment(this.config.output, { ...options, runTests });

		return this.deployService.pollDeploymentStatus(deployId);
	}

	async quickDeploy(deploymentId: string): Promise<DeployResult> {
		await this.authService.authenticate();
		return this.deployService.quickDeploy(deploymentId);
	}
}
