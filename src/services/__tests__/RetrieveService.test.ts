import fs from 'fs';
import { RetrieveService } from '../RetrieveService';
import type { CommandArgsConfig } from '../../types/config.type';

jest.mock('fs');

describe('RetrieveService', () => {
  let service: RetrieveService;
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
    sfVersion: 'v60.0',
    cliVersion: '1.0.0',
    cliOuputFolder: '.output',
    testLevel: 'NoTestRun',
    coverageJson: 'coverage.json',
    runTests: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RetrieveService(mockConfig);
    global.fetch = jest.fn();
  });

  it('forms retrieve payload from manifest path', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('<Package />');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '09Sxx0000000001' }),
    });

    const retrieveId = await service.initiateRetrieve({
      manifestPath: './package.xml',
      outputDir: './out',
    });

    expect(retrieveId).toBe('09Sxx0000000001');
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockConfig.instanceUrl}/services/data/${mockConfig.sfVersion}/metadata/retrieveRequest`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockConfig.accessToken}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          singlePackage: true,
          unpackaged: '<Package />',
        }),
      })
    );
  });

  it('forms retrieve payload from metadata filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '09Sxx0000000002' }),
    });

    await service.initiateRetrieve({
      metadataFilter: 'ApexClass:MyClass,OtherClass;CustomObject:*',
      outputDir: './out',
    });

    const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(fetchBody).toEqual({
      singlePackage: true,
      unpackaged: {
        types: [
          { name: 'ApexClass', members: ['MyClass', 'OtherClass'] },
          { name: 'CustomObject', members: ['*'] },
        ],
        version: '60.0',
      },
    });
  });

  it('parses polling responses until complete', async () => {
    jest.spyOn(service as any, 'wait').mockResolvedValue(undefined);

    jest.spyOn(service as any, 'fetchWithAuth')
      .mockResolvedValueOnce({
        json: async () => ({ id: '09Sxx0000000003', done: false, status: 'InProgress' }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: '09Sxx0000000003',
          done: true,
          status: 'Succeeded',
          zipFile: 'UEsDBAoAAAAAA...',
        }),
      });

    const result = await service.pollRetrieveStatus('09Sxx0000000003');
    expect(result).toEqual({
      id: '09Sxx0000000003',
      done: true,
      status: 'Succeeded',
      zipFile: 'UEsDBAoAAAAAA...',
    });
    expect((service as any).fetchWithAuth).toHaveBeenCalledTimes(2);
    expect((service as any).wait).toHaveBeenCalledTimes(1);
  });
});
