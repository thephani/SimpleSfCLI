import { AuthService } from '../AuthService';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { CommandArgsConfig } from '../../types/config';

jest.mock('fs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  const mockConfig: CommandArgsConfig = {
    clientId: 'test-client-id',
    username: 'test@example.com',
    instanceUrl: 'https://test.salesforce.com',
    privateKey: 'test-private-key.pem',
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
    runTests: []
  };

  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockConfig);
    global.fetch = jest.fn();
    (fs.readFileSync as jest.Mock).mockReturnValue('mock-private-key');
    (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('authenticate', () => {
    it('should successfully authenticate', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          access_token: 'mock-access-token',
          instance_url: 'https://test.salesforce.com'
        })
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await authService.authenticate();

      expect(mockConfig.accessToken).toBe('mock-access-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          iss: mockConfig.clientId,
          sub: mockConfig.username
        }),
        'mock-private-key',
        expect.any(Object)
      );
    });

    it('should handle authentication failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(authService.authenticate()).rejects.toThrow('Authentication failed');
    });
  });
});