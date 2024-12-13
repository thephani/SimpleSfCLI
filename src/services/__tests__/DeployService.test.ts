import { DeployService } from '../DeployService';
import type { CommandArgsConfig } from '../../types/config';

jest.mock('fs');

describe('DeployService', () => {
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
		runTests: [],
	};

	let deployService: DeployService;

	beforeEach(() => {
		deployService = new DeployService(mockConfig);
		global.fetch = jest.fn();
	});

	describe('quickDeploy', () => {
		it('should successfully initiate quick deployment', async () => {
			const mockResponse = {
				ok: true,
				json: () =>
					Promise.resolve({
						id: 'deploy-id',
						status: 'Pending',
					}),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await deployService.quickDeploy('test-deploy-id');

			expect(result).toEqual({
				id: 'deploy-id',
				status: 'Pending',
			});
		});

		it('should handle quick deployment failure', async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				json: () => Promise.resolve({ error: 'Invalid ID' }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			await expect(deployService.quickDeploy('invalid-id')).rejects.toThrow('Quick deploy failed');
		});
	});

	describe('pollDeploymentStatus', () => {
		it('should poll until deployment is complete', async () => {
			const mockResponses = [{ deployResult: { done: false, status: 'InProgress' } }, { deployResult: { done: false, status: 'InProgress' } }, { deployResult: { done: true, status: 'Succeeded' } }];

			(global.fetch as jest.Mock)
				.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponses[0]) })
				.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponses[1]) })
				.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponses[2]) });

			const result = await deployService.pollDeploymentStatus('test-deploy-id');

			expect(result).toEqual({ done: true, status: 'Succeeded' });
			expect(global.fetch).toHaveBeenCalledTimes(3);
		});

		it('should handle polling timeout', async () => {
			jest.useFakeTimers();
			const mockResponse = { deployResult: { done: false, status: 'InProgress' } };
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const pollPromise = deployService.pollDeploymentStatus('test-deploy-id');
			jest.runAllTimers();

			await expect(pollPromise).rejects.toThrow('Deployment timed out');
		});
	});
});
