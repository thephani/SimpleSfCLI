export type ReportFormat = 'json' | 'junit' | 'both';

export interface DeployOptions {
	allowMissingFiles: boolean;
	checkOnly: boolean;
	testLevel: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';
	runTests?: string[];
	rollbackOnError: boolean;
	singlePackage: boolean;
}

export interface DeploymentComponentFailure {
	componentType: string;
	fileName: string;
	fullName: string;
	problem: string;
	problemType: string;
	success: boolean;
}

export interface DeploymentTestFailure {
	name: string;
	methodName: string;
	message: string;
	stackTrace: string;
}

export interface DeploymentSummary {
	deploymentId: string;
	status: DeployResult['status'];
	done: boolean;
	components: {
		deployed: number;
		total: number;
		errors: number;
	};
	tests: {
		completed: number;
		total: number;
		errors: number;
	};
	stateDetail?: string;
}

export interface DeploymentReport {
	generatedAt: string;
	summary: DeploymentSummary;
	componentFailures: DeploymentComponentFailure[];
	testFailures: DeploymentTestFailure[];
}

export interface DeployResult {
	id: string;
	done: boolean;
	status: 'Pending' | 'InProgress' | 'Succeeded' | 'SucceededPartial' | 'Failed' | 'Canceled';
	numberComponentsDeployed: number;
	numberComponentsTotal: number;
	numberComponentErrors: number;
	numberTestsCompleted: number;
	numberTestsTotal: number;
	numberTestErrors: number;
	stateDetail?: string;
	details: {
		componentFailures: DeploymentComponentFailure[];
		runTestResult?: {
			numFailures: number;
			numTestsRun: number;
			totalTime: number;
			failures: DeploymentTestFailure[];
		};
	};
}
