import fs from 'fs';
import os from 'os';
import path from 'path';
import { TEST_PRIVATE_KEY } from '../test/fixtures/auth.fixture';
import { AuthService } from '../services/AuthService';
import { MDAPIService } from '../services/MDAPIService';
import { ArchiverService } from '../services/ArchiverService';
import { DeployService } from '../services/DeployService';

describe('CLI Features & DX Enhancements (F13-F18)', () => {
	const originalArgv = process.argv;
	const originalEnv = { ...process.env };
	const originalCwd = process.cwd();
	const originalFetch = global.fetch;

	let consoleLogSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;
	let tempDir: string;

	const cleanTestEnv = () => {
		delete process.env.SF_USERNAME;
		delete process.env.SF_CLIENT_ID;
		delete process.env.SF_PRIVATE_KEY;
		delete process.env.SF_PRIVATE_KEY_PATH;
		delete process.env.SF_ENV;
		delete process.env.SF_SOURCE;
		delete process.env.SF_EXCLUDE;
		delete process.env.GITHUB_STEP_SUMMARY;
	};

	beforeEach(() => {
		process.env = { ...originalEnv, JEST_SKIP_CLI_AUTO_RUN: '1' };
		cleanTestEnv();
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simple-sf-cli-features-'));
	});

	afterEach(() => {
		process.argv = originalArgv;
		process.env = { ...originalEnv };
		if (process.cwd() !== originalCwd) {
			process.chdir(originalCwd);
		}
		global.fetch = originalFetch;
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		jest.restoreAllMocks();
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	const getCliInstance = async () => {
		const { CLI } = await import('../cli');
		return new CLI(false);
	};

	describe('F13: Environment variable fallbacks in getUpdatedConfig', () => {
		it('uses SF_* environment variables when CLI flags are not provided', async () => {
			process.env.SF_USERNAME = 'env-user@example.com';
			process.env.SF_CLIENT_ID = 'env-client-id';
			process.env.SF_PRIVATE_KEY_PATH = '/tmp/env.key';
			process.env.SF_ENV = 'PRODUCTION';
			process.env.SF_SOURCE = 'env-app/main/default';
			process.env.SF_EXCLUDE = 'Profile, Layout';

			const cli = await getCliInstance();
			const updated = (cli as any).getUpdatedConfig({}, { logUsername: false });

			expect(updated.username).toBe('env-user@example.com');
			expect(updated.clientId).toBe('env-client-id');
			expect(updated.privateKey).toBe('/tmp/env.key');
			expect(updated.env).toBe('PRODUCTION');
			expect(updated.instanceUrl).toBe('https://login.salesforce.com');
			expect(updated.testLevel).toBe('RunLocalTests');
			expect(updated.source).toBe('env-app/main/default');
			expect(updated.exclude).toEqual(['Profile', 'Layout']);
		});

		it('prefers SF_PRIVATE_KEY over SF_PRIVATE_KEY_PATH and CLI flags over all env vars', async () => {
			process.env.SF_USERNAME = 'env-user@example.com';
			process.env.SF_CLIENT_ID = 'env-client-id';
			process.env.SF_PRIVATE_KEY = TEST_PRIVATE_KEY;
			process.env.SF_PRIVATE_KEY_PATH = '/tmp/fallback.key';
			process.env.SF_ENV = 'PRODUCTION';
			process.env.SF_SOURCE = 'env-app/main/default';
			process.env.SF_EXCLUDE = 'Profile';

			const cli = await getCliInstance();
			const envUpdated = (cli as any).getUpdatedConfig({}, { logUsername: false });
			expect(envUpdated.privateKey).toBe(TEST_PRIVATE_KEY);

			const cliOverride = (cli as any).getUpdatedConfig(
				{
					username: 'flag-user@example.com',
					clientId: 'flag-client-id',
					privateKey: '/tmp/flag.key',
					env: 'SANDBOX',
					source: 'flag-app/main/default',
					exclude: ['CustomField,ApexClass'],
				},
				{ logUsername: false },
			);

			expect(cliOverride.username).toBe('flag-user@example.com');
			expect(cliOverride.clientId).toBe('flag-client-id');
			expect(cliOverride.privateKey).toBe('/tmp/flag.key');
			expect(cliOverride.env).toBe('SANDBOX');
			expect(cliOverride.source).toBe('flag-app/main/default');
			expect(cliOverride.exclude).toEqual(['CustomField', 'ApexClass']);
		});
	});

	describe('F14: --dry-run and package command without credentials', () => {
		it('allows getUpdatedConfig without credentials when dryRun or requireAuth=false', async () => {
			const cli = await getCliInstance();
			const updated = (cli as any).getUpdatedConfig({ dryRun: true }, { requireAuth: false, logUsername: false });
			expect(updated.dryRun).toBe(true);
			expect(updated.username).toBeUndefined();
		});

		it('executes package subcommand without authenticating or requiring credentials', async () => {
			const outDir = path.join(tempDir, '.simpleSfCli_out');
			fs.mkdirSync(outDir, { recursive: true });
			fs.writeFileSync(path.join(outDir, 'package.xml'), '<Package/>', 'utf-8');

			jest.spyOn(MDAPIService.prototype, 'convertToMDAPI').mockResolvedValue(['DetectedTest']);
			jest.spyOn(ArchiverService.prototype, 'zipDirectory').mockResolvedValue(undefined);
			const authSpy = jest.spyOn(AuthService.prototype, 'authenticate');
			const deploySpy = jest.spyOn(DeployService.prototype, 'initiateDeployment');

			process.chdir(tempDir);
			const cli = await getCliInstance();
			await (cli as any).program.parseAsync(['node', 'simpleSfCli', 'package']);

			expect(authSpy).not.toHaveBeenCalled();
			expect(deploySpy).not.toHaveBeenCalled();
			expect(MDAPIService.prototype.convertToMDAPI).toHaveBeenCalled();
			expect(ArchiverService.prototype.zipDirectory).toHaveBeenCalledWith('.simpleSfCli_out', 'deploy.zip');
			expect(consoleLogSpy).toHaveBeenCalledWith('Package created at deploy.zip');
		});

		it('executes deploy --dry-run without authenticating or deploying', async () => {
			const outDir = path.join(tempDir, '.simpleSfCli_out');
			fs.mkdirSync(outDir, { recursive: true });
			fs.writeFileSync(path.join(outDir, 'package.xml'), '<Package/>', 'utf-8');

			jest.spyOn(MDAPIService.prototype, 'convertToMDAPI').mockResolvedValue([]);
			jest.spyOn(ArchiverService.prototype, 'zipDirectory').mockResolvedValue(undefined);
			const authSpy = jest.spyOn(AuthService.prototype, 'authenticate');
			const deploySpy = jest.spyOn(DeployService.prototype, 'initiateDeployment');

			process.chdir(tempDir);
			const cli = await getCliInstance();
			await (cli as any).program.parseAsync(['node', 'simpleSfCli', 'deploy', '--dry-run']);

			expect(authSpy).not.toHaveBeenCalled();
			expect(deploySpy).not.toHaveBeenCalled();
			expect(MDAPIService.prototype.convertToMDAPI).toHaveBeenCalled();
			expect(ArchiverService.prototype.zipDirectory).toHaveBeenCalledWith('.simpleSfCli_out', 'deploy.zip');
			expect(consoleLogSpy).toHaveBeenCalledWith('Dry run completed: package created at deploy.zip');
		});
	});

	describe('F15 & F18: --json output mode and GITHUB_STEP_SUMMARY on deploy and quick-deploy', () => {
		const mockDeployResult = {
			id: '0Af000000000123AAA',
			done: true,
			status: 'Succeeded' as const,
			numberComponentsDeployed: 5,
			numberComponentsTotal: 5,
			numberComponentErrors: 0,
			numberTestsCompleted: 2,
			numberTestsTotal: 2,
			numberTestErrors: 0,
			details: {
				componentFailures: [],
			},
		};

		it('outputs structured JSON on deploy --json and appends GITHUB_STEP_SUMMARY', async () => {
			const outDir = path.join(tempDir, '.simpleSfCli_out');
			const summaryFile = path.join(tempDir, 'step-summary.md');
			fs.mkdirSync(outDir, { recursive: true });
			fs.writeFileSync(path.join(outDir, 'package.xml'), '<Package/>', 'utf-8');
			process.env.GITHUB_STEP_SUMMARY = summaryFile;

			jest.spyOn(AuthService.prototype, 'authenticate').mockResolvedValue({
				accessToken: 'token',
				instanceUrl: 'https://test.salesforce.com',
				issuedAt: new Date().toISOString(),
			});
			jest.spyOn(MDAPIService.prototype, 'convertToMDAPI').mockResolvedValue(['AutoTest']);
			jest.spyOn(ArchiverService.prototype, 'zipDirectory').mockResolvedValue(undefined);
			jest.spyOn(DeployService.prototype, 'initiateDeployment').mockResolvedValue('0Af000000000123AAA');
			jest.spyOn(DeployService.prototype, 'pollDeploymentStatus').mockResolvedValue(mockDeployResult);

			process.chdir(tempDir);
			const cli = await getCliInstance();
			await (cli as any).program.parseAsync([
				'node',
				'simpleSfCli',
				'deploy',
				'-u',
				'user@example.com',
				'-c',
				'client-id',
				'-k',
				TEST_PRIVATE_KEY,
				'--validateOnly',
				'--json',
			]);

			const jsonCall = consoleLogSpy.mock.calls.find(([arg]) => typeof arg === 'string' && arg.trim().startsWith('{'));
			expect(jsonCall).toBeDefined();
			const parsed = JSON.parse(jsonCall![0]);
			expect(parsed).toEqual({
				status: 'Succeeded',
				id: '0Af000000000123AAA',
				done: true,
				checkOnly: true,
				numberComponentsDeployed: 5,
				numberComponentsTotal: 5,
				numberTestsCompleted: 2,
				numberTestsTotal: 2,
				details: { componentFailures: [] },
			});

			const summaryContent = fs.readFileSync(summaryFile, 'utf-8');
			expect(summaryContent).toContain('### Salesforce Validation Summary');
			expect(summaryContent).toContain('`0Af000000000123AAA`');
			expect(summaryContent).toContain('`Succeeded`');
		});

		it('outputs structured JSON on quick-deploy --json and appends GITHUB_STEP_SUMMARY', async () => {
			const summaryFile = path.join(tempDir, 'quick-summary.md');
			process.env.GITHUB_STEP_SUMMARY = summaryFile;

			jest.spyOn(AuthService.prototype, 'authenticate').mockResolvedValue({
				accessToken: 'token',
				instanceUrl: 'https://test.salesforce.com',
				issuedAt: new Date().toISOString(),
			});
			jest.spyOn(DeployService.prototype, 'quickDeploy').mockResolvedValue(mockDeployResult);

			const cli = await getCliInstance();
			await (cli as any).program.parseAsync([
				'node',
				'simpleSfCli',
				'quick-deploy',
				'-u',
				'user@example.com',
				'-c',
				'client-id',
				'-k',
				TEST_PRIVATE_KEY,
				'-q',
				'0Af000000000123AAA',
				'--json',
			]);

			const jsonCall = consoleLogSpy.mock.calls.find(([arg]) => typeof arg === 'string' && arg.trim().startsWith('{'));
			expect(jsonCall).toBeDefined();
			const parsed = JSON.parse(jsonCall![0]);
			expect(parsed).toEqual({
				status: 'Succeeded',
				id: '0Af000000000123AAA',
				done: true,
				checkOnly: false,
				numberComponentsDeployed: 5,
				numberComponentsTotal: 5,
				numberTestsCompleted: 2,
				numberTestsTotal: 2,
				details: { componentFailures: [] },
			});

			const summaryContent = fs.readFileSync(summaryFile, 'utf-8');
			expect(summaryContent).toContain('### Salesforce Deployment Summary');
			expect(summaryContent).toContain('`0Af000000000123AAA`');
		});
	});

	describe('F16: Configurable --apiVersion, --tests, --pollInterval, --maxPollAttempts', () => {
		it('normalizes apiVersion, parses comma/space-separated tests, and sets pollInterval and maxPollAttempts', async () => {
			const cli = await getCliInstance();
			const updated = (cli as any).getUpdatedConfig(
				{
					username: 'user@example.com',
					clientId: 'client-id',
					privateKey: TEST_PRIVATE_KEY,
					apiVersion: '61.0',
					tests: ['TestOne,TestTwo', 'TestThree'],
					pollInterval: 2500,
					maxPollAttempts: 45,
				},
				{ logUsername: false },
			);

			expect(updated.sfVersion).toBe('v61.0');
			expect(updated.apiVersion).toBe('v61.0');
			expect(updated.tests).toEqual(['TestOne', 'TestTwo', 'TestThree']);
			expect(updated.runTests).toEqual(['TestOne', 'TestTwo', 'TestThree']);
			expect(updated.pollInterval).toBe(2500);
			expect(updated.maxPollAttempts).toBe(45);
		});

		it('merges CLI --tests with detected test classes during deploy', async () => {
			const outDir = path.join(tempDir, '.simpleSfCli_out');
			fs.mkdirSync(outDir, { recursive: true });
			fs.writeFileSync(path.join(outDir, 'package.xml'), '<Package/>', 'utf-8');

			jest.spyOn(AuthService.prototype, 'authenticate').mockResolvedValue({
				accessToken: 'token',
				instanceUrl: 'https://test.salesforce.com',
				issuedAt: new Date().toISOString(),
			});
			jest.spyOn(MDAPIService.prototype, 'convertToMDAPI').mockResolvedValue(['DetectedTestClass', 'ExtraTest1']);
			jest.spyOn(ArchiverService.prototype, 'zipDirectory').mockResolvedValue(undefined);
			const initiateSpy = jest.spyOn(DeployService.prototype, 'initiateDeployment').mockResolvedValue('0Af000000000999AAA');
			jest.spyOn(DeployService.prototype, 'pollDeploymentStatus').mockResolvedValue({
				id: '0Af000000000999AAA',
				done: true,
				status: 'Succeeded',
				numberComponentsDeployed: 1,
				numberComponentsTotal: 1,
				numberComponentErrors: 0,
				numberTestsCompleted: 3,
				numberTestsTotal: 3,
				numberTestErrors: 0,
				details: { componentFailures: [] },
			});

			process.chdir(tempDir);
			const cli = await getCliInstance();
			await (cli as any).program.parseAsync([
				'node',
				'simpleSfCli',
				'deploy',
				'-u',
				'user@example.com',
				'-c',
				'client-id',
				'-k',
				TEST_PRIVATE_KEY,
				'-t',
				'RunSpecifiedTests',
				'--tests',
				'ExtraTest1,ExtraTest2',
				'ExtraTest3',
			]);

			expect(initiateSpy).toHaveBeenCalledWith(
				'deploy.zip',
				expect.objectContaining({
					testLevel: 'RunSpecifiedTests',
					runTests: ['DetectedTestClass', 'ExtraTest1', 'ExtraTest2', 'ExtraTest3'],
				}),
			);
		});
	});

	describe('F17: Auto-read sfdx-project.json', () => {
		it('reads default packageDirectory and sourceApiVersion from sfdx-project.json when --source is not set', async () => {
			const customPkgDir = path.join(tempDir, 'my-pkg', 'main', 'default');
			fs.mkdirSync(customPkgDir, { recursive: true });
			fs.writeFileSync(
				path.join(tempDir, 'sfdx-project.json'),
				JSON.stringify({
					packageDirectories: [
						{ path: 'other-pkg', default: false },
						{ path: 'my-pkg/main/default', default: true },
					],
					sourceApiVersion: '62.0',
				}),
				'utf-8',
			);

			process.chdir(tempDir);
			const cli = await getCliInstance();
			const updated = (cli as any).getUpdatedConfig(
				{
					username: 'user@example.com',
					clientId: 'client-id',
					privateKey: TEST_PRIVATE_KEY,
				},
				{ logUsername: false },
			);

			expect(updated.source).toBe('my-pkg/main/default');
			expect(updated.sfVersion).toBe('v62.0');
		});

		it('falls back to force-app/main/default when sfdx-project.json directory does not exist on disk', async () => {
			fs.writeFileSync(
				path.join(tempDir, 'sfdx-project.json'),
				JSON.stringify({
					packageDirectories: [{ path: 'non-existent-dir', default: true }],
					sourceApiVersion: '59.0',
				}),
				'utf-8',
			);

			process.chdir(tempDir);
			const cli = await getCliInstance();
			const updated = (cli as any).getUpdatedConfig(
				{
					username: 'user@example.com',
					clientId: 'client-id',
					privateKey: TEST_PRIVATE_KEY,
				},
				{ logUsername: false },
			);

			expect(updated.source).toBe('force-app/main/default');
			expect(updated.sfVersion).toBe('v59.0');
		});

		it('allows CLI --source and --apiVersion to override sfdx-project.json values', async () => {
			const customPkgDir = path.join(tempDir, 'my-pkg');
			fs.mkdirSync(customPkgDir, { recursive: true });
			fs.writeFileSync(
				path.join(tempDir, 'sfdx-project.json'),
				JSON.stringify({
					packageDirectories: [{ path: 'my-pkg', default: true }],
					sourceApiVersion: '58.0',
				}),
				'utf-8',
			);

			process.chdir(tempDir);
			const cli = await getCliInstance();
			const updated = (cli as any).getUpdatedConfig(
				{
					username: 'user@example.com',
					clientId: 'client-id',
					privateKey: TEST_PRIVATE_KEY,
					source: 'explicit-source/main/default',
					apiVersion: 'v63.0',
				},
				{ logUsername: false },
			);

			expect(updated.source).toBe('explicit-source/main/default');
			expect(updated.sfVersion).toBe('v63.0');
		});
	});
});
