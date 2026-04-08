import { SalesforceClient } from '../SalesforceClient';
import type { CommandArgsConfig } from '../types/config.type';

const authenticateMock = jest.fn();
const initiateRetrieveMock = jest.fn();
const pollRetrieveStatusMock = jest.fn();
const extractBase64ZipMock = jest.fn();

jest.mock('../services/AuthService', () => ({
  AuthService: jest.fn().mockImplementation(() => ({ authenticate: authenticateMock })),
}));

jest.mock('../services/RetrieveService', () => ({
  RetrieveService: jest.fn().mockImplementation(() => ({
    initiateRetrieve: initiateRetrieveMock,
    pollRetrieveStatus: pollRetrieveStatusMock,
  })),
}));

jest.mock('../services/ArchiverService', () => ({
  ArchiverService: jest.fn().mockImplementation(() => ({
    zipDirectory: jest.fn(),
    extractBase64Zip: extractBase64ZipMock,
  })),
}));

jest.mock('../services/DeployService', () => ({
  DeployService: jest.fn().mockImplementation(() => ({
    initiateDeployment: jest.fn(),
    pollDeploymentStatus: jest.fn(),
    quickDeploy: jest.fn(),
  })),
}));

jest.mock('../services/MDAPIService', () => ({
  MDAPIService: jest.fn().mockImplementation(() => ({ convertToMDAPI: jest.fn() })),
}));

describe('SalesforceClient retrieve', () => {
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
    sfVersion: 'v60.0',
    cliVersion: '1.0.0',
    cliOuputFolder: '.output',
    testLevel: 'NoTestRun',
    coverageJson: 'coverage.json',
    runTests: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates, retrieves, and extracts mdapi output', async () => {
    initiateRetrieveMock.mockResolvedValue('09Sxx0000000001');
    pollRetrieveStatusMock.mockResolvedValue({
      id: '09Sxx0000000001',
      done: true,
      status: 'Succeeded',
      zipFile: 'UEsDBAoAAAAAA...',
    });
    extractBase64ZipMock.mockResolvedValue(undefined);

    const client = new SalesforceClient(config);
    const result = await client.retrieve({
      metadataFilter: 'ApexClass:MyClass',
      outputDir: './retrieve-out',
      targetLayout: 'mdapi',
    });

    expect(authenticateMock).toHaveBeenCalledTimes(1);
    expect(initiateRetrieveMock).toHaveBeenCalledWith({
      metadataFilter: 'ApexClass:MyClass',
      outputDir: './retrieve-out',
      targetLayout: 'mdapi',
    });
    expect(extractBase64ZipMock).toHaveBeenCalledWith('UEsDBAoAAAAAA...', './retrieve-out');
    expect(result).toEqual({ id: '09Sxx0000000001', status: 'Succeeded', outputDir: './retrieve-out' });
  });

  it('throws when retrieve status is not succeeded', async () => {
    initiateRetrieveMock.mockResolvedValue('09Sxx0000000002');
    pollRetrieveStatusMock.mockResolvedValue({
      id: '09Sxx0000000002',
      done: true,
      status: 'Failed',
      errorMessage: 'Retrieve failed',
    });

    const client = new SalesforceClient(config);

    await expect(
      client.retrieve({ metadataFilter: 'ApexClass:MyClass', outputDir: './retrieve-out', targetLayout: 'mdapi' })
    ).rejects.toThrow('Retrieve failed');
  });

  it('rejects unsupported target layouts', async () => {
    const client = new SalesforceClient(config);

    await expect(
      client.retrieve({ metadataFilter: 'ApexClass:MyClass', outputDir: './retrieve-out', targetLayout: 'mdapi2' as any })
    ).rejects.toThrow('Unsupported target layout: mdapi2. Only mdapi is currently supported.');

    expect(authenticateMock).not.toHaveBeenCalled();
  });
});
