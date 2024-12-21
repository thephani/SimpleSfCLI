
import type { CommandArgsConfig } from '../../types/config.type';
import { AuthService } from '../AuthService';
import fs from 'fs';
import jwt from 'jsonwebtoken';

// Mock modules
jest.mock('fs');
jest.mock('jsonwebtoken');

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
    const MOCK_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----';
    const MOCK_JWT_TOKEN = 'mock.jwt.token';
    const MOCK_ACCESS_TOKEN = 'mock-access-token';
    const MOCK_INSTANCE_URL = 'https://instance.salesforce.com';

    let service: AuthService;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Setup service instance
        service = new AuthService(mockConfig);
        
        // Setup fs mock
        (fs.readFileSync as jest.Mock).mockReturnValue(MOCK_PRIVATE_KEY);
        
        // Setup jwt mock
        (jwt.sign as jest.Mock).mockReturnValue(MOCK_JWT_TOKEN);
        
        // Setup fetch mock
        global.fetch = jest.fn();
    });

    describe('authenticate', () => {
        it('should authenticate successfully', async () => {
            // Mock successful response
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: MOCK_ACCESS_TOKEN,
                    instance_url: MOCK_INSTANCE_URL
                })
            });

            await service.authenticate();

            // Verify private key was read
            expect(fs.readFileSync).toHaveBeenCalledWith(
                mockConfig.privateKey,
                'utf-8'
            );

            // Verify JWT token creation
            expect(jwt.sign).toHaveBeenCalledWith(
                {
                    iss: mockConfig.clientId,
                    sub: mockConfig.username,
                    aud: mockConfig.instanceUrl,
                    exp: expect.any(Number)
                },
                MOCK_PRIVATE_KEY,
                { algorithm: 'RS256' }
            );

            // Verify OAuth request
            expect(global.fetch).toHaveBeenCalledWith(
                `${mockConfig.instanceUrl}/services/oauth2/token`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${MOCK_JWT_TOKEN}`
                }
            );

            // Verify that a subsequent request would use the new access token and instance URL
            const testEndpoint = '/test/endpoint';
            await (service as any).fetchWithAuth(testEndpoint);

            expect(global.fetch).toHaveBeenLastCalledWith(
                expect.stringContaining(MOCK_INSTANCE_URL),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${MOCK_ACCESS_TOKEN}`
                    })
                })
            );
        });

        it('should handle file read errors', async () => {
            (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
                throw new Error('File not found');
            });

            await expect(service.authenticate())
                .rejects
                .toThrow('Authentication error: File not found');
        });

        it('should handle JWT signing errors', async () => {
            (jwt.sign as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Invalid key');
            });

            await expect(service.authenticate())
                .rejects
                .toThrow('Authentication error: Invalid key');
        });

        it('should handle failed authentication', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            await expect(service.authenticate())
                .rejects
                .toThrow('Authentication error: Authentication failed: 401');
        });
    });

    describe('JWT token creation', () => {
        it('should create valid JWT token', () => {
            const timestamp = 1234567890000;
            jest.spyOn(Date, 'now').mockReturnValue(timestamp);

            const token = (service as any).createJwtToken(MOCK_PRIVATE_KEY);

            expect(jwt.sign).toHaveBeenCalledWith(
                {
                    iss: mockConfig.clientId,
                    sub: mockConfig.username,
                    aud: mockConfig.instanceUrl,
                    exp: Math.floor(timestamp / 1000) + 60
                },
                MOCK_PRIVATE_KEY,
                { algorithm: 'RS256' }
            );

            expect(token).toBe(MOCK_JWT_TOKEN);
        });
    });

    describe('Access token retrieval', () => {
        it('should get access token successfully', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    access_token: MOCK_ACCESS_TOKEN,
                    instance_url: MOCK_INSTANCE_URL
                })
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            await (service as any).getAccessToken(MOCK_JWT_TOKEN);

            // Verify token is being used in subsequent requests
            const testEndpoint = '/test/endpoint';
            await (service as any).fetchWithAuth(testEndpoint);

            expect(global.fetch).toHaveBeenLastCalledWith(
                expect.stringContaining(MOCK_INSTANCE_URL),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${MOCK_ACCESS_TOKEN}`
                    })
                })
            );
        });

        it('should handle failed token retrieval', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 403
            });

            await expect((service as any).getAccessToken(MOCK_JWT_TOKEN))
                .rejects
                .toThrow('Authentication failed: 403');
        });

        it('should handle network errors', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(
                new Error('Network error')
            );

            await expect((service as any).getAccessToken(MOCK_JWT_TOKEN))
                .rejects
                .toThrow('Network error');
        });
    });
});