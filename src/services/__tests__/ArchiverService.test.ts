import { ArchiverService } from '../ArchiverService';
import archiver from 'archiver';
import fs from 'fs';
import { CommandArgsConfig } from '../../types/config';

jest.mock('fs');
jest.mock('archiver');

describe('ArchiverService', () => {
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

	let archiverService: ArchiverService;

	beforeEach(() => {
		archiverService = new ArchiverService(mockConfig);
	});

	describe('zipDirectory', () => {
		it('should successfully create zip archive', async () => {
			const mockOutput = {
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'close') {
						callback();
					}
				}),
			};

			const mockArchive = {
				pipe: jest.fn(),
				directory: jest.fn(),
				finalize: jest.fn(),
				on: jest.fn(),
			};

			(fs.createWriteStream as jest.Mock).mockReturnValue(mockOutput);
			(archiver as unknown as jest.Mock).mockReturnValue(mockArchive);

			await archiverService.zipDirectory('source', 'output.zip');

			expect(fs.createWriteStream).toHaveBeenCalledWith('output.zip');
			expect(mockArchive.directory).toHaveBeenCalledWith('source', false);
			expect(mockArchive.finalize).toHaveBeenCalled();
		});

		it('should handle archiving errors', async () => {
			const mockArchive = {
				pipe: jest.fn(),
				directory: jest.fn(),
				finalize: jest.fn(),
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'error') {
						callback(new Error('Archive error'));
					}
				}),
			};

			(archiver as unknown as jest.Mock).mockReturnValue(mockArchive);

			await expect(archiverService.zipDirectory('source', 'output.zip')).rejects.toThrow('Archive error');
		});
	});
});
