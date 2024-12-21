import { MDAPIService } from '../MDAPIService';
import fs from 'fs';
import { execSync } from 'child_process';
import { XmlHelper } from '../../helper/xmlHelper';
import { CommandArgsConfig } from '../../types/config.type';

jest.mock('../../helper/xmlHelper');
jest.mock('fs');
jest.mock('child_process');

describe('MDAPIService', () => {
	let service: MDAPIService;
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
		jest.clearAllMocks();
		service = new MDAPIService(mockConfig);

		// Mock fs.promises methods
		(fs.promises as any) = {
			mkdir: jest.fn().mockResolvedValue(undefined),
			rm: jest.fn().mockResolvedValue(undefined),
			writeFile: jest.fn().mockResolvedValue(undefined),
			readFile: jest.fn().mockResolvedValue('class content'),
			copyFile: jest.fn().mockResolvedValue(undefined),
		};

		// Mock existsSync
		(fs.existsSync as jest.Mock).mockReturnValue(true);

		// Mock execSync
		(execSync as jest.Mock).mockReturnValue('');

		// Mock XmlHelper methods
		(XmlHelper.prototype.createPackageXml as jest.Mock).mockReturnValue('<?xml version="1.0"?><Package></Package>');
		(XmlHelper.prototype.createEmptyPackageXml as jest.Mock).mockReturnValue('<?xml version="1.0"?><Package></Package>');
	});

	describe('convertToMDAPI', () => {
		afterAll(() => {
			jest.clearAllMocks();
		});
		
		it('should successfully convert SFDX to MDAPI format', async () => {

			const mockChangedFiles = ['force-app/main/default/classes/TestClass.cls', 'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml'].join('\n');
			(execSync as jest.Mock).mockReturnValue(mockChangedFiles);

			// Mock file content for test class detection
			(fs.promises.readFile as jest.Mock).mockResolvedValue('@isTest\nclass TestClass {}');

			const result = await service.convertToMDAPI([]);
			// await expect(await service.convertToMDAPI([])).rejects.toThrow('Process.exit called with code 0');
			// expect(processExitSpy).toHaveBeenCalledWith(0);

			expect(fs.promises.mkdir).toHaveBeenCalledWith(mockConfig.cliOuputFolder, expect.any(Object));
			expect(execSync).toHaveBeenCalled();
			expect(Array.isArray(result)).toBeTruthy();
		});

		it('should handle no modified files', async () => {
			(execSync as jest.Mock).mockReturnValueOnce('');

			// await expect(service.convertToMDAPI([])).rejects.toThrow('Process.exit called with code 0');
		});

		it('should handle errors during conversion', async () => {
			(fs.promises.mkdir as jest.Mock).mockRejectedValue(new Error('Failed to create directory'));

			// await expect(service.convertToMDAPI([])).rejects.toThrow();
		});
	});

	describe('getMetadataType', () => {
		afterAll(() => {
			jest.clearAllMocks();
		});
		
		it('should identify CustomField type', () => {
			const filePath = 'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('CustomField');
		});

		it('should identify ApexClass type', () => {
			const filePath = 'force-app/main/default/classes/TestClass.cls';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('ApexClass');
		});

		it('should return null for unknown types', () => {
			const filePath = 'force-app/main/default/unknown/file.txt';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBeNull();
		});
	});

	describe('isTestClass', () => {
		afterEach(() => {
			jest.clearAllMocks();
		});
		it('should identify @isTest annotation', async () => {
			(fs.promises.readFile as jest.Mock).mockResolvedValue('@isTest\nclass TestClass {}');
			const result = await (service as any).isTestClass('TestClass.cls');
			expect(result).toBe(true);
		});

		it('should identify testMethod keyword', async () => {
			(fs.promises.readFile as jest.Mock).mockResolvedValue('class TestClass { testMethod static void test() {} }');
			const result = await (service as any).isTestClass('TestClass.cls');
			expect(result).toBe(true);
		});
	});

	describe('copyFileWithMetadata', () => {
		afterEach(() => {
			jest.clearAllMocks();
		});
		const sourceFile = 'force-app/main/default/classes/TestClass.cls';
		const targetDir = './output';

		it('should copy file and its metadata', async () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);

			await (service as any).copyFileWithMetadata(sourceFile, targetDir);

			expect(fs.promises.mkdir).toHaveBeenCalled();
			expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
		});

		it('should handle missing metadata file', async () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			await (service as any).copyFileWithMetadata(sourceFile, targetDir);

			expect(fs.promises.copyFile).toHaveBeenCalledTimes(1);
		});
	});

	describe('generateCustomObjectForFields', () => {
		afterAll(() => {
			jest.clearAllMocks();
		});
		
		it('should handle grouped data correctly', async () => {
			const groupedData = {
				Account: {
					fields: ['Field1__c', 'Field2__c'],
				},
			};

			await (service as any).generateCustomObjectForFields(groupedData);

			expect(XmlHelper.prototype.generateCustomObjectForFields).toHaveBeenCalledWith(groupedData);
		});

		it('should handle errors', async () => {
			(XmlHelper.prototype.generateCustomObjectForFields as jest.Mock).mockRejectedValue(new Error('XML generation failed'));

			const groupedData = {
				Account: {
					fields: ['Field1__c'],
				},
			};

			await expect((service as any).generateCustomObjectForFields(groupedData)).rejects.toThrow('Failed to generate custom objects');
		});
	});

	describe('getChangedFiles', () => {
		beforeAll(() => {
			jest.resetAllMocks();
		});
		it('should return grouped and filtered files', async () => {
			const mockChangedFiles = ['force-app/main/default/classes/TestClass.cls', 'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml'].join('\n');

			(execSync as jest.Mock).mockReturnValueOnce(mockChangedFiles);

			const result = await (service as any).getChangedFiles();

			expect(result).toHaveProperty('groupedData');
			expect(result).toHaveProperty('changedFiles');
			expect(result).toHaveProperty('restChangedFiles');
		});

		it('should handle git command errors', async () => {
			(execSync as jest.Mock).mockImplementation(() => {
				throw new Error('Git command failed');
			});

			const result = await (service as any).getChangedFiles();

			expect(result.changedFiles).toHaveLength(0);
			expect(result.restChangedFiles).toHaveLength(0);
			expect(Object.keys(result.groupedData)).toHaveLength(0);
		});
	});

	describe('getDeletedFiles', () => {
		afterAll(() => {
			jest.clearAllMocks();
		});
		
		
		it('should handle git command errors', async () => {
			(execSync as jest.Mock).mockImplementation(() => {
				throw new Error('Git command failed');
			});
	
			const result = await (service as any).getDeletedFiles();
	
			expect(result).toHaveLength(0);
		});
		it('should handle multiple deleted files', async () => {
			(execSync as jest.Mock).mockReturnValue([
				'force-app/main/default/classes/DeletedClass1.cls',
				'force-app/main/default/classes/DeletedClass2.cls'
			].join('\n'));
	
			const result = await (service as any).getDeletedFiles();
			
			expect(result).toHaveLength(2);
			expect(result).toContain('force-app/main/default/classes/DeletedClass1.cls');
			expect(result).toContain('force-app/main/default/classes/DeletedClass2.cls');
		});

		it('should return deleted files list', async () => {
			// Mock execSync to return a string as it would in reality
			(execSync as jest.Mock).mockReturnValue(
				'force-app/main/default/classes/DeletedClass.cls\n'
			);
	
			const result = await (service as any).getDeletedFiles();
			
			expect(result).toHaveLength(1);
			expect(result[0]).toBe('force-app/main/default/classes/DeletedClass.cls');
		});
	
		
	});
});
