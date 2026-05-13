import fs from 'fs';
import os from 'os';
import path from 'path';
import { decodeJwtPart, TEST_PRIVATE_KEY } from '../test/fixtures/auth.fixture';

describe('auth:token CLI integration', () => {
	const originalArgv = process.argv;
	const originalFetch = global.fetch;
	let consoleLogSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;
	let tempDir: string;
	let privateKeyPath: string;

	beforeEach(() => {
		jest.resetModules();
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simple-sf-cli-auth-token-'));
		privateKeyPath = path.join(tempDir, 'server.key');
		fs.writeFileSync(privateKeyPath, TEST_PRIVATE_KEY, { encoding: 'utf-8', mode: 0o600 });
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				access_token: 'cli-access-token',
				instance_url: 'https://cli-org.my.salesforce.com',
			}),
		});
	});

	afterEach(() => {
		process.argv = originalArgv;
		global.fetch = originalFetch;
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		jest.restoreAllMocks();
	});

	const waitForCliAction = async (): Promise<void> => {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			if ((global.fetch as jest.Mock).mock.calls.length > 0 && consoleLogSpy.mock.calls.length > 0) {
				return;
			}

			await new Promise((resolve) => setImmediate(resolve));
		}

		throw new Error('Timed out waiting for auth:token action');
	};

	const runAuthToken = async (env: string): Promise<{
		requestUrl: string;
		requestBody: URLSearchParams;
		stdout: Record<string, string>;
		stderr: string;
	}> => {
		process.argv = [
			'node',
			'simpleSfCli',
			'auth:token',
			'--username',
			'cli-user@example.com',
			'--clientId',
			'cli-client-id',
			'--privateKey',
			privateKeyPath,
			'--env',
			env,
			'--json',
		];

		await import('../cli');
		await waitForCliAction();

		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		const requestUrl = fetchCall[0] as string;
		const requestBody = fetchCall[1].body as URLSearchParams;
		const stdout = JSON.parse(consoleLogSpy.mock.calls[0][0]) as Record<string, string>;
		const stderr = consoleErrorSpy.mock.calls[0][0] as string;

		return { requestUrl, requestBody, stdout, stderr };
	};

	it.each([
		['SANDBOX', 'https://test.salesforce.com'],
		['PROD', 'https://login.salesforce.com'],
	])('generates a token for %s using the expected Salesforce auth URL', async (env, expectedAuthUrl) => {
		const { requestUrl, requestBody, stdout, stderr } = await runAuthToken(env);

		expect(requestUrl).toBe(`${expectedAuthUrl}/services/oauth2/token`);
		expect(requestBody.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');

		const assertion = requestBody.get('assertion')!;
		expect(assertion.split('.')).toHaveLength(3);
		expect(decodeJwtPart(assertion, 0)).toEqual({ alg: 'RS256', typ: 'JWT' });
		expect(decodeJwtPart(assertion, 1)).toEqual({
			iss: 'cli-client-id',
			sub: 'cli-user@example.com',
			aud: expectedAuthUrl,
			exp: expect.any(Number),
		});

		expect(stdout).toEqual({
			accessToken: 'cli-access-token',
			instanceUrl: 'https://cli-org.my.salesforce.com',
			issuedAt: expect.any(String),
			username: 'cli-user@example.com',
		});
		expect(stderr).toMatch(/^⏱️ Command completed in \d+\.\d{2} seconds\.$/);
	});
});
