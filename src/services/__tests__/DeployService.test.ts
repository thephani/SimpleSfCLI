import { DeployService } from '../DeployService';
import fs from 'fs';
import type { CommandArgsConfig } from '../../types/config';
import type { DeployOptions } from '../../types/deployment';

jest.mock('fs');

describe('DeployService', () => {
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

    let deployService: DeployService;

    beforeEach(() => {
        deployService = new DeployService(mockConfig);
        global.fetch = jest.fn();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('quickDeploy', () => {
        it('should successfully initiate quick deployment', async () => {
            const mockResponse = {
                ok: true,
                json: () => Promise.resolve({
                    id: 'quick-deploy-id',
                    status: 'Pending'
                })
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await deployService.quickDeploy('test-deploy-id');

            expect(result).toEqual({
                id: 'quick-deploy-id',
                status: 'Pending'
            });
            expect(global.fetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/services/data/56.0/metadata/deployRequest/validatedDeployRequestId',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ validatedDeployRequestId: 'test-deploy-id' })
                })
            );
        });

        it('should handle quick deployment failure', async () => {
            const mockResponse = {
                ok: false,
                status: 400,
                json: () => Promise.resolve({ error: 'Invalid deployment ID' })
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            await expect(deployService.quickDeploy('invalid-id'))
                .rejects
                .toThrow('Quick deploy error');
        });
    });

    describe('initiateDeployment', () => {
        const mockZipPath = 'test.zip';
        const mockZipContent = Buffer.from('test-content');

        beforeEach(() => {
            (fs.readFileSync as jest.Mock).mockReturnValue(mockZipContent);
        });

        it('should successfully initiate deployment', async () => {
            const mockResponse = {
                ok: true,
                text: () => Promise.resolve('<result><id>deploy-123</id></result>')
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await deployService.initiateDeployment(mockZipPath, { checkOnly: true });

            expect(result).toBe('deploy-123');
            expect(global.fetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/services/Soap/m/56.0',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/xml',
                        SOAPAction: 'deploy'
                    }
                })
            );
        });

        it('should handle deployment initiation failure', async () => {
            const mockResponse = {
                ok: false,
                status: 500
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            await expect(deployService.initiateDeployment(mockZipPath))
                .rejects
                .toThrow('Deployment failed: 500');
        });

        it('should handle invalid deployment response', async () => {
            const mockResponse = {
                ok: true,
                text: () => Promise.resolve('<result>invalid</result>')
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            await expect(deployService.initiateDeployment(mockZipPath))
                .rejects
                .toThrow('Failed to extract deployment ID');
        });
    });

    describe('pollDeploymentStatus', () => {
        it('should successfully poll until deployment is complete', async () => {
            const mockResponses = [
                { deployResult: { done: false, status: 'InProgress' } },
                { deployResult: { done: false, status: 'InProgress' } },
                { deployResult: { done: true, status: 'Succeeded' } }
            ];

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponses[0]) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponses[1]) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponses[2]) });

            const pollPromise = deployService.pollDeploymentStatus('test-deploy-id');
            
            // Fast-forward through setTimeout calls
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            const result = await pollPromise;

            expect(result).toEqual({ done: true, status: 'Succeeded' });
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('should handle polling timeout', async () => {
            const mockResponse = { 
                ok: true,
                json: () => Promise.resolve({ 
                    deployResult: { done: false, status: 'InProgress' } 
                })
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const pollPromise = deployService.pollDeploymentStatus('test-deploy-id');

            // Fast-forward through all timeouts
            for (let i = 0; i < 120; i++) {
                jest.runOnlyPendingTimers();
            }

            await expect(pollPromise).rejects.toThrow('Deployment timed out');
        });

        it('should handle polling errors', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Internal server error' })
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const pollPromise = deployService.pollDeploymentStatus('test-deploy-id');
            jest.runOnlyPendingTimers();

            await expect(pollPromise).rejects.toThrow();
        });
    });

    describe('createDeployRequest', () => {
        it('should generate correct SOAP request with specified tests', () => {
            const mockZipContent = Buffer.from('test-content');
            (fs.readFileSync as jest.Mock).mockReturnValue(mockZipContent);

            const options: Partial<DeployOptions> = {
                checkOnly: true,
                testLevel: 'RunSpecifiedTests',
                runTests: ['Test1', 'Test2']
            };

            const result = (deployService as any).createDeployRequest('test.zip', options);

            expect(result).toContain('<met:checkOnly>true</met:checkOnly>');
            expect(result).toContain('<met:testLevel>RunSpecifiedTests</met:testLevel>');
            expect(result).toContain('<met:runTests>Test1</met:runTests>');
            expect(result).toContain('<met:runTests>Test2</met:runTests>');
        });

        it('should generate correct SOAP request without specified tests', () => {
            const mockZipContent = Buffer.from('test-content');
            (fs.readFileSync as jest.Mock).mockReturnValue(mockZipContent);

            const options: Partial<DeployOptions> = {
                checkOnly: false,
                testLevel: 'NoTestRun'
            };

            const result = (deployService as any).createDeployRequest('test.zip', options);

            expect(result).toContain('<met:checkOnly>false</met:checkOnly>');
            expect(result).toContain('<met:testLevel>NoTestRun</met:testLevel>');
            expect(result).not.toContain('<met:runTests>');
        });
    });
});