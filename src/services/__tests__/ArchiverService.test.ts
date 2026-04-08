import { ArchiverService } from '../ArchiverService';
import fs from 'fs';
import archiver from 'archiver';
import { Writable } from 'stream';
import { execFile } from 'child_process';
import type { CommandArgsConfig } from '../../types/config.type';

jest.mock('archiver');
jest.mock('child_process', () => ({ execFile: jest.fn() }));

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
		baseBranch: 'HEAD~1',
		targetBranch: 'HEAD',
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
		jest.clearAllMocks();

		mockWriteStream = new Writable({ write: (_chunk, _encoding, callback) => callback() });
		mockArchiver = {
			on: jest.fn().mockReturnThis(),
			pipe: jest.fn().mockReturnThis(),
			directory: jest.fn().mockReturnThis(),
			finalize: jest.fn().mockReturnThis(),
			abort: jest.fn().mockReturnThis(),
		} as any;

		jest.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriteStream as fs.WriteStream);
		jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
		jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
		jest.spyOn(fs.promises, 'mkdtemp').mockResolvedValue('/tmp/retrieve');
		jest.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
		(archiver as unknown as jest.Mock).mockReturnValue(mockArchiver);
		(execFile as unknown as jest.Mock).mockImplementation((_cmd, _args, callback) => callback(null, '', ''));

		service = new ArchiverService(mockConfig);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should successfully zip a directory', async () => {
		mockArchiver.pipe.mockImplementation(() => {
			setTimeout(() => mockWriteStream.emit('close'), 0);
			return mockArchiver;
		});

		await service.zipDirectory('source/directory', 'output/file.zip');
		expect(fs.createWriteStream).toHaveBeenCalledWith('output/file.zip');
		expect(mockArchiver.directory).toHaveBeenCalledWith('source/directory', false);
	});

	it('should extract zip to output directory using unzip command', async () => {
		await service.extractZipFile('/tmp/file.zip', './out');
		expect(fs.promises.mkdir).toHaveBeenCalledWith('./out', { recursive: true });
		expect(execFile).toHaveBeenCalledWith('unzip', ['-o', '/tmp/file.zip', '-d', './out'], expect.any(Function));
	});

	it('should persist temp zip and cleanup after extraction', async () => {
		const extractSpy = jest.spyOn(service, 'extractZipFile').mockResolvedValue(undefined);
		await service.extractBase64Zip(Buffer.from('zip-content').toString('base64'), './retrieve-out');

		expect(fs.promises.writeFile).toHaveBeenCalledWith('/tmp/retrieve/retrieve.zip', expect.any(Buffer));
		expect(extractSpy).toHaveBeenCalledWith('/tmp/retrieve/retrieve.zip', './retrieve-out');
		expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/retrieve', { recursive: true, force: true });
	});
});
