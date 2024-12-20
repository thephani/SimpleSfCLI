export interface CommandArgsConfig {
	source: string;
	output: string;
	env: 'SANDBOX' | 'PRODUCTION';
	accessToken?: string;
	clientId?: string;
	exclude?: string[];
	username?: string;
	privateKey?: string;
	appVersion: string;
	appDescription: string;
	instanceUrl?: string;
	sfVersion: string;
	cliVersion: string;
	cliOuputFolder: string;
	quickDeployId?: string;
	testLevel: 'NoTestRun' | 'RunLocalTests' | 'RunAllTestsInOrg' | 'RunSpecifiedTests';
	coverageJson: string;
	runTests: string[];
}
