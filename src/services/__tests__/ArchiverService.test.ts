import { ArchiverService } from '../ArchiverService';
import fs from 'fs';
import archiver from 'archiver';
import type { CommandArgsConfig } from '../../types/config.type';
import { Writable } from 'stream';

// Mock fs and archiver
jest.mock('fs');
jest.mock('archiver');

describe('ArchiverService', () => {
	let service: ArchiverService;
	let mockWriteStream: Writable;
	let mockArchiver: any;

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

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks();

		// Create mock write stream
		mockWriteStream = new Writable({
			write: (_chunk, _encoding, callback) => {
				callback();
			},
		});

		// Create mock archiver
		mockArchiver = {
			on: jest.fn(),
			pipe: jest.fn(),
			directory: jest.fn(),
			finalize: jest.fn(),
		};

		// Setup fs mock
		(fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

		// Setup archiver mock
		(archiver as unknown as jest.Mock).mockReturnValue(mockArchiver);

		// Initialize service
		service = new ArchiverService(mockConfig);
	});

	describe('zipDirectory', () => {
		const sourceDir = 'source/directory';
		const outputFile = 'output/file.zip';

		it('should successfully zip a directory', async () => {
			// Setup archiver mock to emit close event
			mockArchiver.pipe.mockImplementation(() => {
				setTimeout(() => {
					mockWriteStream.emit('close');
				}, 0);
				return mockArchiver;
			});

			await service.zipDirectory(sourceDir, outputFile);

			// Verify write stream creation
			expect(fs.createWriteStream).toHaveBeenCalledWith(outputFile);

			// Verify archiver initialization
			expect(archiver).toHaveBeenCalledWith('zip', { zlib: { level: 9 } });

			// Verify archiver operations
			expect(mockArchiver.pipe).toHaveBeenCalledWith(mockWriteStream);
			expect(mockArchiver.directory).toHaveBeenCalledWith(sourceDir, false);
			expect(mockArchiver.finalize).toHaveBeenCalled();
		});

		it('should handle archiver errors', async () => {
			const errorMessage = 'Archiver error';

			// Setup archiver mock to emit error
			mockArchiver.pipe.mockImplementation(() => {
				setTimeout(() => {
					mockArchiver.on.mock.calls.find((call: any) => call[0] === 'error')?.[1](new Error(errorMessage));
				}, 0);
				return mockArchiver;
			});

			await expect(service.zipDirectory(sourceDir, outputFile)).rejects.toThrow(errorMessage);
		});

		it('should handle write stream errors', async () => {
			const errorMessage = 'Write stream error';

			// Setup write stream to emit error
			mockArchiver.pipe.mockImplementation(() => {
				setTimeout(() => {
					mockWriteStream.emit('error', new Error(errorMessage));
				}, 0);
				return mockArchiver;
			});

			await expect(service.zipDirectory(sourceDir, outputFile)).rejects.toThrow();
		});

		it('should handle file system errors', async () => {
			const errorMessage = 'File system error';

			(fs.createWriteStream as jest.Mock).mockImplementation(() => {
				throw new Error(errorMessage);
			});

			await expect(service.zipDirectory(sourceDir, outputFile)).rejects.toThrow(errorMessage);
		});

		it('should use correct compression level', async () => {
			mockArchiver.pipe.mockImplementation(() => {
				setTimeout(() => {
					mockWriteStream.emit('close');
				}, 0);
				return mockArchiver;
			});

			await service.zipDirectory(sourceDir, outputFile);

			expect(archiver).toHaveBeenCalledWith('zip', {
				zlib: { level: 9 },
			});
		});
	});
});
