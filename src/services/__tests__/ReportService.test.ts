import fs from 'fs';
import os from 'os';
import path from 'path';
import { ReportService } from '../ReportService';
import { DeployService } from '../DeployService';
import type { CommandArgsConfig } from '../../types/config.type';
import type { DeployResult } from '../../types/deployment.type';

describe('ReportService', () => {
	let reportService: ReportService;
	let reportDir: string;

	beforeEach(async () => {
		reportService = new ReportService();
		reportDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sf-report-'));
	});

	afterEach(async () => {
		await fs.promises.rm(reportDir, { recursive: true, force: true });
	});

	it('writes a JSON report with expected shape', async () => {
		const files = await reportService.writeDeploymentReport(
			{
				summary: {
					deploymentId: '0Afxx0000001234',
					status: 'Succeeded',
					done: true,
					components: { deployed: 10, total: 10, errors: 0 },
					tests: { completed: 5, total: 5, errors: 0 },
				},
				componentFailures: [],
				testFailures: [],
			},
			{ reportFormat: 'json', reportPath: reportDir }
		);

		expect(files).toHaveLength(1);
		expect(files[0]).toContain('.json');

		const raw = await fs.promises.readFile(files[0], 'utf8');
		const parsed = JSON.parse(raw);
		expect(parsed.summary.deploymentId).toBe('0Afxx0000001234');
		expect(Array.isArray(parsed.componentFailures)).toBe(true);
		expect(Array.isArray(parsed.testFailures)).toBe(true);
	});

	it('failed deployments produce non-empty failure sections in JSON and JUnit', async () => {
		const files = await reportService.writeDeploymentReport(
			{
				summary: {
					deploymentId: '0Afxx0000009999',
					status: 'Failed',
					done: true,
					components: { deployed: 2, total: 4, errors: 2 },
					tests: { completed: 3, total: 3, errors: 1 },
					stateDetail: 'Deployment failed',
				},
				componentFailures: [
					{
						componentType: 'ApexClass',
						fileName: 'classes/MyClass.cls',
						fullName: 'MyClass',
						problem: 'Unexpected token',
						problemType: 'Error',
						success: false,
					},
				],
				testFailures: [
					{
						name: 'MyClassTest',
						methodName: 'shouldFail',
						message: 'Assertion Failed',
						stackTrace: 'Class.MyClassTest.shouldFail: line 12, column 1',
					},
				],
			},
			{ reportFormat: 'both', reportPath: reportDir }
		);

		expect(files).toHaveLength(2);
		const jsonPath = files.find((file) => file.endsWith('.json'));
		const xmlPath = files.find((file) => file.endsWith('.xml'));
		expect(jsonPath).toBeDefined();
		expect(xmlPath).toBeDefined();

		const rawJson = await fs.promises.readFile(jsonPath!, 'utf8');
		const parsed = JSON.parse(rawJson);
		expect(parsed.componentFailures.length).toBeGreaterThan(0);
		expect(parsed.testFailures.length).toBeGreaterThan(0);

		const rawXml = await fs.promises.readFile(xmlPath!, 'utf8');
		expect(rawXml).toContain('<failure message="Error">Unexpected token</failure>');
		expect(rawXml).toContain('<testsuites name="Salesforce Deployment 0Afxx0000009999"');
		expect(rawXml).toContain('<testsuite name="Apex Tests" tests="3" failures="1">');
		expect(rawXml).toContain('<testcase classname="ApexTests" name="passed-1" />');
	});

	it('creates JUnit testcases for passing tests when there are no failures', () => {
		const xml = reportService.generateJUnitReport({
			generatedAt: new Date().toISOString(),
			summary: {
				deploymentId: '0Afxx0000007777',
				status: 'Succeeded',
				done: true,
				components: { deployed: 5, total: 5, errors: 0 },
				tests: { completed: 2, total: 2, errors: 0 },
			},
			componentFailures: [],
			testFailures: [],
		});

		expect(xml).toContain('<testsuite name="Apex Tests" tests="2" failures="0">');
		expect(xml).toContain('<testcase classname="ApexTests" name="passed-1" />');
		expect(xml).toContain('<testcase classname="ApexTests" name="passed-2" />');
	});

	it('uses DeployService serializers for failed deployment failure sections', () => {
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
		};
		const deployService = new DeployService(config);
		const failedStatus = {
			id: '0Afxx0000001111',
			done: true,
			status: 'Failed',
			numberComponentsDeployed: 1,
			numberComponentsTotal: 2,
			numberComponentErrors: 1,
			numberTestsCompleted: 1,
			numberTestsTotal: 1,
			numberTestErrors: 1,
			details: {
				componentFailures: [
					{
						componentType: 'ApexTrigger',
						fileName: 'triggers/Example.trigger',
						fullName: 'Example',
						problem: 'Compile error',
						problemType: 'Error',
						success: false,
					},
				],
				runTestResult: {
					numFailures: 1,
					numTestsRun: 1,
					totalTime: 50,
					failures: [
						{
							name: 'ExampleTest',
							methodName: 'failingMethod',
							message: 'Expected true but got false',
							stackTrace: 'Class.ExampleTest.failingMethod: line 22, column 1',
						},
					],
				},
			},
		} as DeployResult;

		expect(deployService.serializeSummary(failedStatus).status).toBe('Failed');
		expect(deployService.serializeComponentFailures(failedStatus)).not.toHaveLength(0);
		expect(deployService.serializeTestFailures(failedStatus)).not.toHaveLength(0);
	});
});
