import fs from 'fs';
import os from 'os';
import path from 'path';
import type { CommandArgsConfig } from '../../types/config.type';
import { AuthService } from '../AuthService';
import { decodeJwtPart, TEST_PRIVATE_KEY } from '../../test/fixtures/auth.fixture';

describe('AuthService integration', () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	const createConfig = (instanceUrl: string, privateKey: string): CommandArgsConfig => ({
		clientId: 'integration-client-id',
		username: 'integration@example.com',
		instanceUrl,
		privateKey,
		accessToken: undefined,
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
	});

	it('loads a real private key file, posts a signed JWT assertion, and persists session details', async () => {
		const instanceUrl = 'https://login.salesforce.com';
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simple-sf-cli-auth-'));
		const privateKeyPath = path.join(tempDir, 'server.key');
		fs.writeFileSync(privateKeyPath, TEST_PRIVATE_KEY, { encoding: 'utf-8', mode: 0o600 });

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				access_token: 'integration-access-token',
				instance_url: 'https://integration.my.salesforce.com',
			}),
		});

		const config = createConfig(instanceUrl, privateKeyPath);
		const result = await new AuthService(config).authenticate();

		expect(global.fetch).toHaveBeenCalledWith(`${instanceUrl}/services/oauth2/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: expect.any(URLSearchParams),
		});

		const requestBody = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
		expect(requestBody.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');

		const assertion = requestBody.get('assertion')!;
		expect(assertion.split('.')).toHaveLength(3);
		expect(decodeJwtPart(assertion, 0)).toEqual({ alg: 'RS256', typ: 'JWT' });
		expect(decodeJwtPart(assertion, 1)).toEqual({
			iss: 'integration-client-id',
			sub: 'integration@example.com',
			aud: instanceUrl,
			exp: expect.any(Number),
		});

		expect(result).toEqual({
			accessToken: 'integration-access-token',
			instanceUrl: 'https://integration.my.salesforce.com',
			issuedAt: expect.any(String),
		});
		expect(config.accessToken).toBe('integration-access-token');
		expect(config.instanceUrl).toBe('https://integration.my.salesforce.com');
		expect(fs.statSync(privateKeyPath).mode & 0o777).toBe(0o600);
	});
});
