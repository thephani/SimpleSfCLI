import { DeployService } from '../DeployService';
import fs from 'fs';
import type { CommandArgsConfig } from '../../types/config.type';
// import type {  DeployResult } from '../../types/deployment.type';

jest.mock('fs');

describe('DeployService', () => {
    let service: DeployService;
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
		sfVersion: 'v62.0',
		cliVersion: '1.0.0',
		cliOuputFolder: '.output',
		testLevel: 'NoTestRun',
		coverageJson: 'coverage.json',
		runTests: [],
	};
    const MOCK_DEPLOY_ID = 'mock-deploy-id';
    const MOCK_ZIP_PATH = './test.zip';
    const MOCK_ZIP_CONTENT = Buffer.from('test-zip-content');
    const MOCK_BASE64_ZIP = MOCK_ZIP_CONTENT.toString('base64');

    beforeEach(() => {
        jest.clearAllMocks();
        service = new DeployService(mockConfig);
        global.fetch = jest.fn();
        (fs.readFileSync as jest.Mock).mockReturnValue(MOCK_ZIP_CONTENT);
    }, 10000); // Increase timeout to 10 seconds

    describe('quickDeploy', () => {
        const MOCK_DEPLOY_RESULT = {
            id: MOCK_DEPLOY_ID,
            status: 'Succeeded',
            done: true,
        };

        it('should successfully initiate quick deploy', async () => {
            const mockResponse = {
                ok: true,
                json: async () => MOCK_DEPLOY_RESULT,
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await service.quickDeploy(MOCK_DEPLOY_ID);

            expect(global.fetch).toHaveBeenCalledWith(
                `${mockConfig.instanceUrl}/services/data/${mockConfig.sfVersion}/metadata/deployRequest/validatedDeployRequestId`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mockConfig.accessToken}`
                    },
                    body: JSON.stringify({ validatedDeployRequestId: MOCK_DEPLOY_ID }),
                }
            );
            expect(result).toEqual(MOCK_DEPLOY_RESULT);
        });

        it('should poll deployment status when quick deploy response is not yet done', async () => {
            const quickDeployResponse = {
                ok: true,
                json: async () => ({ id: 'quick-deploy-id', done: false, status: 'Pending' }),
            };
            const finalResult = {
                id: 'quick-deploy-id',
                status: 'Succeeded' as const,
                done: true,
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce(quickDeployResponse);
            const pollSpy = jest.spyOn(service, 'pollDeploymentStatus').mockResolvedValueOnce(finalResult as any);

            const result = await service.quickDeploy(MOCK_DEPLOY_ID);

            expect(pollSpy).toHaveBeenCalledWith('quick-deploy-id');
            expect(result).toEqual(finalResult);
        });

        it('should handle quick deploy errors', async () => {
            const errorMessage = 'Quick deploy failed';
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

            await expect(service.quickDeploy(MOCK_DEPLOY_ID))
                .rejects
                .toThrow(`Quick deploy error: ${errorMessage}`);
        });
    });

    describe('initiateDeployment', () => {
        const mockSoapResponse = `
            <?xml version="1.0" encoding="UTF-8"?>
            <soapenv:Envelope>
                <soapenv:Body>
                    <deployResponse>
                        <result>
                            <id>${MOCK_DEPLOY_ID}</id>
                        </result>
                    </deployResponse>
                </soapenv:Body>
            </soapenv:Envelope>
        `;

        it('should successfully initiate deployment', async () => {
            const mockResponse = {
                ok: true,
                text: async () => mockSoapResponse,
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            const deployId = await service.initiateDeployment(MOCK_ZIP_PATH);

            expect(fs.readFileSync).toHaveBeenCalledWith(MOCK_ZIP_PATH);
            expect(global.fetch).toHaveBeenCalledWith(
                `${mockConfig.instanceUrl}/services/Soap/m/62.0`,
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/xml',
                        'SOAPAction': 'deploy'
                    },
                    body: expect.stringContaining(MOCK_BASE64_ZIP)
                })
            );
            expect(deployId).toBe(MOCK_DEPLOY_ID);
        });

        it('should derive SOAP endpoint version from configured sfVersion', async () => {
            const customService = new DeployService({ ...mockConfig, sfVersion: 'v60.0' });
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                text: async () => mockSoapResponse,
            });

            await customService.initiateDeployment(MOCK_ZIP_PATH);

            expect(global.fetch).toHaveBeenCalledWith(
                `${mockConfig.instanceUrl}/services/Soap/m/60.0`,
                expect.any(Object),
            );
        });

        it('should handle deployment initiation errors', async () => {
            const mockResponse = {
                ok: false,
                status: 400,
                text: async () => 'Bad Request',
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            await expect(service.initiateDeployment(MOCK_ZIP_PATH))
                .rejects
                .toThrow('Deployment failed: 400');
        });

        it('should handle missing deployment ID in response', async () => {
            const mockResponse = {
                ok: true,
                text: async () => '<invalid>xml</invalid>',
            };
            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            await expect(service.initiateDeployment(MOCK_ZIP_PATH))
                .rejects
                .toThrow('Failed to extract deployment ID');
        });
    });

    describe('pollDeploymentStatus', () => {
        beforeEach(() => {
            // Mock the private wait method to resolve immediately
            jest.spyOn(service as any, 'wait').mockResolvedValue(undefined);
        });
        it('should successfully poll until deployment is done', async () => {
            const mockInProgressResponse = {
                ok: true,
                json: async () => ({ 
                    deployResult: { 
                        id: MOCK_DEPLOY_ID, 
                        status: 'InProgress',
                        done: false 
                    } 
                }),
            };
    
            const mockCompletedResponse = {
                ok: true,
                json: async () => ({ 
                    deployResult: { 
                        id: MOCK_DEPLOY_ID, 
                        status: 'Succeeded',
                        done: true 
                    } 
                }),
            };
    
            // Mock fetchWithAuth instead of fetch directly
            jest.spyOn(service as any, 'fetchWithAuth')
                .mockResolvedValueOnce(mockInProgressResponse)
                .mockResolvedValueOnce(mockCompletedResponse);
    
            const result = await service.pollDeploymentStatus(MOCK_DEPLOY_ID);
    
            expect(result).toEqual({
                id: MOCK_DEPLOY_ID,
                status: 'Succeeded',
                done: true
            });
            
            expect(service['fetchWithAuth']).toHaveBeenCalledTimes(2);
            expect(service['wait']).toHaveBeenCalledTimes(1);
        });

        it('should log full test failure and component failure tables on Failed or SucceededPartial', async () => {
            const tableSpy = jest.spyOn(console, 'table').mockImplementation(() => undefined);
            const mockPartialFailureResponse = {
                ok: true,
                json: async () => ({
                    deployResult: {
                        id: MOCK_DEPLOY_ID,
                        status: 'SucceededPartial',
                        done: true,
                        numberComponentsDeployed: 1,
                        numberComponentsTotal: 2,
                        numberTestsTotal: 1,
                        numberTestsCompleted: 1,
                        details: {
                            componentFailures: [
                                {
                                    componentType: 'ApexClass',
                                    fileName: 'classes/Broken.cls',
                                    fullName: 'Broken',
                                    problem: 'Compile failure',
                                    problemType: 'Error',
                                    success: false,
                                },
                            ],
                            runTestResult: {
                                numFailures: 1,
                                numTestsRun: 1,
                                totalTime: 10,
                                failures: [
                                    {
                                        name: 'BrokenTest',
                                        methodName: 'testMethod1',
                                        message: 'System.AssertException: Assertion Failed',
                                        stackTrace: 'Class.BrokenTest.testMethod1: line 10, column 1',
                                    },
                                ],
                            },
                        },
                    },
                }),
            };

            jest.spyOn(service as any, 'fetchWithAuth').mockResolvedValueOnce(mockPartialFailureResponse);

            await expect(service.pollDeploymentStatus(MOCK_DEPLOY_ID))
                .rejects
                .toThrow(`Deployment ${MOCK_DEPLOY_ID} ended with status SucceededPartial`);

            expect(tableSpy).toHaveBeenCalledWith([
                {
                    name: 'BrokenTest',
                    methodName: 'testMethod1',
                    message: 'System.AssertException: Assertion Failed',
                    stackTrace: 'Class.BrokenTest.testMethod1: line 10, column 1',
                },
            ]);
            expect(tableSpy).toHaveBeenCalledWith([
                {
                    fileName: 'classes/Broken.cls',
                    fullName: 'Broken',
                    problem: 'Compile failure',
                },
            ]);
            tableSpy.mockRestore();
        });

        it('should timeout after max attempts', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ 
                    deployResult: { 
                        id: MOCK_DEPLOY_ID, 
                        status: 'InProgress',
                        done: false 
                    } 
                }),
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            // Override wait function to speed up test
            (service as any).wait = jest.fn().mockResolvedValue(undefined);

            await expect(service.pollDeploymentStatus(MOCK_DEPLOY_ID))
                .rejects
                .toThrow('Deployment timed out');
        });
    });

    describe('generateRunTestsXml', () => {
        it('should generate XML for specified tests', () => {
            const options = {
                testLevel: 'RunSpecifiedTests',
                runTests: ['Test1', 'Test2']
            };

            const result = (service as any).generateRunTestsXml(options);
            expect(result).toBe('<met:runTests>Test1</met:runTests><met:runTests>Test2</met:runTests>');
        });

        it('should return empty string for other test levels', () => {
            const options = {
                testLevel: 'NoTestRun'
            };

            const result = (service as any).generateRunTestsXml(options);
            expect(result).toBe('');
        });
    });
});
