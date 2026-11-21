import { SalesforceClient } from '../../SalesforceClient';
import { DeploymentFailedError } from '../../errors/DeploymentFailedError';
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

	it('writes a deployment report even when the deployment fails with DeploymentFailedError', async () => {
		const client = new SalesforceClient(config);
		const failedResult = {
			id: '0Afxx0000006666',
			done: true,
			status: 'Failed',
			numberComponentsDeployed: 1,
			numberComponentsTotal: 2,
			numberComponentErrors: 1,
			numberTestsCompleted: 0,
			numberTestsTotal: 0,
			numberTestErrors: 0,
			details: {
				componentFailures: [
					{
						componentType: 'ApexClass',
						fileName: 'classes/Broken.cls',
						fullName: 'Broken',
						problem: 'Compile error',
						problemType: 'Error',
						success: false,
					},
				],
			},
		} as DeployResult;

		const writeSpy = jest.spyOn((client as any).reportService, 'writeDeploymentReport').mockResolvedValueOnce(['./reports/failed.json']);

		await expect(
			(client as any).withReport(async () => {
				throw new DeploymentFailedError(failedResult.id, failedResult);
			}),
		).rejects.toThrow(`Deployment ${failedResult.id} ended with status Failed`);

		expect(writeSpy).toHaveBeenCalledTimes(1);
		expect(writeSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				summary: expect.objectContaining({ deploymentId: '0Afxx0000006666', status: 'Failed' }),
			}),
			expect.objectContaining({ reportFormat: 'both' }),
		);
	});
});
