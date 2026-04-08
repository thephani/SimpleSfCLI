import { SalesforceClient } from '../../SalesforceClient';
import type { CommandArgsConfig } from '../../types/config.type';
import type { DeployResult } from '../../types/deployment.type';

describe('SalesforceClient report generation', () => {
	const config: CommandArgsConfig = {
		clientId: 'test-client-id',
		username: 'test@example.com',
		instanceUrl: 'https://test.salesforce.com',
		privateKey: 'test-private-key.pem',
		accessToken: 'mock-access-token',
		source: 'src',
		output: 'deploy.zip',
		env: 'SANDBOX',
		baseBranch: 'HEAD~1',
		targetBranch: 'HEAD',
		appVersion: '1.0.0',
		appDescription: 'Test App',
		sfVersion: '56.0',
		cliVersion: '1.0.0',
		cliOuputFolder: '.output',
		testLevel: 'NoTestRun',
		coverageJson: 'coverage.json',
		runTests: [],
		reportFormat: 'both',
		reportPath: './reports',
	};

	it('does not throw when report writing fails', async () => {
		const client = new SalesforceClient(config);
		const deployResult = {
			id: '0Afxx0000005555',
			done: true,
			status: 'Succeeded',
			numberComponentsDeployed: 4,
			numberComponentsTotal: 4,
			numberComponentErrors: 0,
			numberTestsCompleted: 2,
			numberTestsTotal: 2,
			numberTestErrors: 0,
			details: {
				componentFailures: [],
				runTestResult: {
					numFailures: 0,
					numTestsRun: 2,
					totalTime: 12,
					failures: [],
				},
			},
		} as DeployResult;

		const writeSpy = jest.spyOn((client as any).reportService, 'writeDeploymentReport').mockRejectedValueOnce(new Error('disk full'));
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		await expect((client as any).generateReport(deployResult)).resolves.toBeUndefined();
		expect(writeSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledWith('⚠️ Failed to generate deployment report:', 'disk full');

		warnSpy.mockRestore();
	});
});
