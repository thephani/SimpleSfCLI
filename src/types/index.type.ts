export interface Config {
	clientId: string;
	username: string;
	instanceUrl: string;
	privateKey: string;
	accessToken?: string;
	sfVersion: string;
}

export interface DeploymentResult {
	numberComponentsDeployed: number;
	numberComponentsTotal: number;
	numberComponentErrors: number;
	numberTestsCompleted: number;
	numberTestsTotal: number;
	numberTestErrors: number;
	status: string;
	details: {
		componentFailures: ComponentFailure[];
	};
}

export interface ComponentFailure {
	componentType: string;
	fileName: string;
	problem: string;
	problemType: string;
}

export interface MetadataType {
	name: string;
	members: string[];
}
