import type { CommandArgsConfig } from '../../types/config.type';
import { AuthService } from '../AuthService';
import fs from 'fs';
import { decodeJwtPart, TEST_PRIVATE_KEY } from '../../test/fixtures/auth.fixture';

// Mock modules
jest.mock('fs');

describe('AuthService', () => {
	// Mock config
	const mockConfig: CommandArgsConfig = {
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

	// Test constants
	const MOCK_PRIVATE_KEY = TEST_PRIVATE_KEY;
	const MOCK_JWT_TOKEN = 'mock.jwt.token';
	const MOCK_ACCESS_TOKEN = 'mock-access-token';
	const MOCK_INSTANCE_URL = 'https://test.salesforce.com';

	let service: AuthService;

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks();

		// Setup service instance
		service = new AuthService(mockConfig);

		// Setup fs mock
		(fs.readFileSync as jest.Mock).mockReturnValue(MOCK_PRIVATE_KEY);

		// Setup fetch mock
		global.fetch = jest.fn();
	});

	describe('authenticate', () => {
		it('should authenticate successfully', async () => {
			// Mock successful response
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: async () => ({
					access_token: MOCK_ACCESS_TOKEN,
					instance_url: MOCK_INSTANCE_URL,
				}),
			});

			const result = await service.authenticate();

			// Verify private key was read
			expect(fs.readFileSync).toHaveBeenCalledWith(mockConfig.privateKey, 'utf-8');

			// Verify OAuth request
			expect(global.fetch).toHaveBeenCalledWith(`${mockConfig.instanceUrl}/services/oauth2/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: expect.any(URLSearchParams),
			});
			const tokenRequestBody = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
			expect(tokenRequestBody.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
			const assertion = tokenRequestBody.get('assertion')!;
			expect(assertion.split('.')).toHaveLength(3);
			expect(decodeJwtPart(assertion, 0)).toEqual({
				alg: 'RS256',
				typ: 'JWT',
			});
			expect(decodeJwtPart(assertion, 1)).toEqual({
				aud: mockConfig.instanceUrl,
				exp: expect.any(Number),
				iss: mockConfig.clientId,
				sub: mockConfig.username,
			});

			expect(result).toEqual({
				accessToken: MOCK_ACCESS_TOKEN,
				instanceUrl: MOCK_INSTANCE_URL,
				issuedAt: expect.any(String),
			});
			expect(mockConfig.accessToken).toBe(MOCK_ACCESS_TOKEN);
			expect(mockConfig.instanceUrl).toBe(MOCK_INSTANCE_URL);

			// Verify that a subsequent request would use the new access token and instance URL
			const testEndpoint = '/test/endpoint';
			await (service as any).fetchWithAuth(testEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${MOCK_JWT_TOKEN}`,
			});

			expect(global.fetch).toHaveBeenCalledTimes(2);
	
		});

		it('should handle file read errors', async () => {
			(fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
				throw new Error('File not found');
			});

			await expect(service.authenticate()).rejects.toThrow('Authentication error: File not found');
		});

		it('should handle JWT signing errors', async () => {
			(fs.readFileSync as jest.Mock).mockReturnValueOnce('invalid-key');

			await expect(service.authenticate()).rejects.toThrow('Authentication error:');
		});

		it('should handle failed authentication', async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: async () => JSON.stringify({
					error: 'invalid_grant',
					error_description: 'audience is invalid',
				}),
			});

			await expect(service.authenticate()).rejects.toThrow(
				'Authentication error: Authentication failed: 401 Unauthorized tokenUrl=https://test.salesforce.com/services/oauth2/token error=invalid_grant description=audience is invalid'
			);
		});
	});

	describe('JWT token creation', () => {
		it('should create valid JWT token', () => {
			const timestamp = 1234567890000;
			jest.spyOn(Date, 'now').mockReturnValue(timestamp);

			const token = (service as any).createJwtToken(MOCK_PRIVATE_KEY);

			expect(token.split('.')).toHaveLength(3);
			expect(decodeJwtPart(token, 0)).toEqual({
				alg: 'RS256',
				typ: 'JWT',
			});
			expect(decodeJwtPart(token, 1)).toEqual({
				iss: mockConfig.clientId,
				sub: mockConfig.username,
				aud: mockConfig.instanceUrl,
				exp: Math.floor(timestamp / 1000) + 60,
			});
		});
	});

    describe('AuthService', () => {
        let service: AuthService;
        const MOCK_ACCESS_TOKEN = 'mock-access-token';
        const MOCK_INSTANCE_URL = 'https://test.salesforce.com';
        const MOCK_JWT_TOKEN = 'mock.jwt.token';
    
        beforeEach(() => {
            service = new AuthService(mockConfig);
            global.fetch = jest.fn();
        });
    
        it('should get access token successfully', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    access_token: MOCK_ACCESS_TOKEN,
                    instance_url: MOCK_INSTANCE_URL,
                }),
            };
    
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    
            const result = await (service as any).getAccessToken(MOCK_JWT_TOKEN);

			expect(result).toEqual({
				accessToken: MOCK_ACCESS_TOKEN,
				instanceUrl: MOCK_INSTANCE_URL,
				issuedAt: expect.any(String),
			});
    
            // Test subsequent request with full URL
            await (service as any).fetchWithAuth('/test/endpoint', {
                method: 'GET',
            });
    
            // Check the last fetch call specifically
            const lastCallArgs = (global.fetch as jest.Mock).mock.calls[(global.fetch as jest.Mock).mock.calls.length - 1];
            expect(lastCallArgs[0]).toBe('/test/endpoint');
            expect(lastCallArgs[1]).toEqual({
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${MOCK_ACCESS_TOKEN}`
                }
            });
        });
		it('should handle failed token retrieval', async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: false,
				status: 403,
				text: async () => JSON.stringify({
					error: 'invalid_client',
					error_description: 'invalid client credentials',
				}),
			});

			await expect((service as any).getAccessToken(MOCK_JWT_TOKEN)).rejects.toThrow(
				'Authentication failed: 403 tokenUrl=https://test.salesforce.com/services/oauth2/token error=invalid_client description=invalid client credentials'
			);
		});

		it('should include plain text authentication failures', async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				text: async () => 'invalid assertion',
			});

			await expect((service as any).getAccessToken(MOCK_JWT_TOKEN)).rejects.toThrow(
				'Authentication failed: 400 Bad Request tokenUrl=https://test.salesforce.com/services/oauth2/token response=invalid assertion'
			);
		});

		it('should handle authentication failures without response bodies', async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: async () => '',
			});

			await expect((service as any).getAccessToken(MOCK_JWT_TOKEN)).rejects.toThrow(
				'Authentication failed: 500 tokenUrl=https://test.salesforce.com/services/oauth2/token'
			);
		});

		it('should handle authentication failures when response body reading fails', async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: false,
				status: 502,
				text: async () => {
					throw new Error('Body unavailable');
				},
			});

			await expect((service as any).getAccessToken(MOCK_JWT_TOKEN)).rejects.toThrow(
				'Authentication failed: 502 tokenUrl=https://test.salesforce.com/services/oauth2/token'
			);
		});

		it('should handle JSON authentication failures without Salesforce error fields', async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: false,
				status: 418,
				text: async () => JSON.stringify({ message: 'teapot' }),
			});

			await expect((service as any).getAccessToken(MOCK_JWT_TOKEN)).rejects.toThrow(
				'Authentication failed: 418 tokenUrl=https://test.salesforce.com/services/oauth2/token'
			);
		});

		it('should handle network errors', async () => {
			(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

			await expect((service as any).getAccessToken(MOCK_JWT_TOKEN)).rejects.toThrow('Network error');
		});
    
        afterEach(() => {
            jest.resetAllMocks();
        });
    });
    
});
