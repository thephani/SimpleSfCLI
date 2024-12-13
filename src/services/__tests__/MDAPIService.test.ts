import { MDAPIService } from '../MDAPIService.js';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { CommandArgsConfig } from '../../types/config.js';

jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('../../helper/xmlHelper');

describe('MDAPIService', () => {
  const mockConfig: CommandArgsConfig = {
    instanceUrl: 'https://test.salesforce.com',
    accessToken: 'mock-token',
    sfVersion: '56.0',
    username: 'test@example.com',
    clientId: 'test-client-id',
    privateKey: 'test-key.pem',
    source: 'force-app/main/default',
    output: 'deploy.zip',
    env: 'SANDBOX',
    testLevel: 'NoTestRun' as const,
    appVersion: '1.0.0',
    appDescription: 'Test App',
    cliVersion: '1.0.0',
    cliOuputFolder: '.output',
    coverageJson: 'coverage.json',
    runTests: []
  };

  let service: MDAPIService;

  beforeEach(() => {
    service = new MDAPIService(mockConfig);
    jest.clearAllMocks();
  });

  describe('convertToMDAPI', () => {
    beforeEach(() => {
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/classes/TestClass.cls\n' +
        'force-app/main/default/objects/Account/fields/CustomField.field-meta.xml'
      );
    });

    it('should successfully convert SFDX to MDAPI format', async () => {
      const result = await service.convertToMDAPI('source', 'target');
      
      expect(result).toBeDefined();
      expect(execSync).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should handle no changed files', async () => {
      (execSync as jest.Mock).mockReturnValue('');

      await expect(
        service.convertToMDAPI('source', 'target')
      ).rejects.toThrow('No changed files found');
    });

    it('should exclude specified metadata types', async () => {
      const result = await service.convertToMDAPI(
        'source',
        'target',
        ['ApexClass']
      );

      expect(result).toEqual([]);
    });
  });

  describe('file processing', () => {
    it('should generate correct member name for Apex class', async () => {
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/classes/TestClass.cls'
      );

      await service.convertToMDAPI('source', 'target');
      
      // Verify package.xml includes correct member
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('TestClass')
      );
    });

    it('should handle custom fields correctly', async () => {
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/objects/Account/fields/CustomField.field-meta.xml'
      );

      await service.convertToMDAPI('source', 'target');
      
      // Verify package.xml includes correct member
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Account.CustomField')
      );
    });
    });
});