import { MDAPIService } from '../MDAPIService';
import fs from 'fs';
import { execSync } from 'child_process';
import { XmlHelper } from '../../helper/xmlHelper';
import { CommandArgsConfig } from '../../types/config.type';
import path from 'path';
import { ForceIgnoreHelper } from '../../helper/forceignoreHelper';

jest.mock('../../helper/xmlHelper');
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../helper/forceignoreHelper');

describe('MDAPIService', () => {
	let service: MDAPIService;
	const mockConfig: CommandArgsConfig = {
		clientId: 'test-client-id',
		username: 'test@example.com',
		instanceUrl: 'https://test.salesforce.com',
		privateKey: 'test-private-key.pem',
		accessToken: 'mock-access-token',
		source: 'force-app/main/default',
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
		(ForceIgnoreHelper as jest.MockedClass<typeof ForceIgnoreHelper>).prototype.shouldIgnore = jest.fn().mockReturnValue(false);
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

		it('should identify Profile type', () => {
			const filePath = 'force-app/main/default/profiles/Admin.profile-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('Profile');
		});

		it('should identify ConversationMessageDefinition type', () => {
			const filePath = 'force-app/main/default/conversationMessageDefinitions/test.ConversationMessageDefinition-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('ConversationMessageDefinition');
		});

		it('should identify LWC', () => {
			const filePath = 'force-app/main/default/lwc/test/test.html';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('LightningComponentBundle');
		});

		it('should ignore lwc jsconfig file', () => {
			const filePath = 'force-app/main/default/lwc/jsconfig.json';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBeNull();
		});

		it('should ignore files matched by .forceignore', () => {
			(ForceIgnoreHelper as jest.MockedClass<typeof ForceIgnoreHelper>).prototype.shouldIgnore = jest.fn().mockReturnValue(true);
			service = new MDAPIService(mockConfig);
			const filePath = 'force-app/main/default/profiles/Admin.profile-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBeNull();
		});

		it('should identify Group', () => {
			const filePath = 'force-app/main/default/groups/sandbox-users.group-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('Group');
		});

		it('should identify CustomObject type', () => {
			const filePath = 'force-app/main/default/objects/Account/Account.object-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('CustomObject');
		});

	});

	describe('forceignore path handling', () => {
		it('should match source-prefixed .forceignore paths', () => {
			jest.unmock('../../helper/forceignoreHelper');
			const { ForceIgnoreHelper: RealForceIgnoreHelper } = jest.requireActual('../../helper/forceignoreHelper');

			(fs.existsSync as jest.Mock).mockImplementation((filePath: fs.PathLike) => String(filePath).endsWith('.forceignore'));
			(fs.readFileSync as unknown as jest.Mock).mockReturnValue('force-app/main/default/labels/CustomLabels.labels-meta.xml\n');

			const helper = new RealForceIgnoreHelper(mockConfig.source);
			expect(helper.shouldIgnore('labels/CustomLabels.labels-meta.xml')).toBe(true);
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

			await (service as any).getMemberName(sourceFile, targetDir);
			const items = fs.readdirSync(targetDir);
			console.log('items', items);

			items?.map((item) => {
				const fullPath = path.join(targetDir, item);
				return {
					name: item,
					type: fs.statSync(fullPath).isDirectory() ? 'folder' : 'file',
				};
			});
			// expect(fs.promises.mkdir).toHaveBeenCalled();
			// expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
		});

		it('should handle missing metadata file', async () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			await (service as any).copyFileWithMetadata(sourceFile, targetDir);

			expect(fs.promises.copyFile).toHaveBeenCalledTimes(1);
		});

		it('should ignore lwc jsconfig file during copy', async () => {
			const jsConfigFile = 'force-app/main/default/lwc/jsconfig.json';

			await (service as any).copyFileWithMetadata(jsConfigFile);

			expect(fs.promises.copyFile).not.toHaveBeenCalled();
			expect(fs.promises.mkdir).not.toHaveBeenCalled();
		});

		it('should flatten custom object metadata to MDAPI object path', async () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);
			const objectFile = 'force-app/main/default/objects/Account/Account.object-meta.xml';

			await (service as any).copyFileWithMetadata(objectFile);

			expect(fs.promises.copyFile).toHaveBeenCalledWith(
				objectFile,
				path.join(mockConfig.cliOuputFolder, 'objects', 'Account.object'),
			);
		});
	});

	// describe('generateCustomObjectForFields', () => {
	// 	afterAll(() => {
	// 		jest.clearAllMocks();
	// 	});

	// 	it('should handle grouped data correctly', async () => {
	// 		const groupedData = {
	// 			Account: {
	// 				fields: ['Field1__c', 'Field2__c'],
	// 			},
	// 		};

	// 		await (service as any).processModifiedMetadata(groupedData);

	// 		expect(XmlHelper.prototype.generateCustomObjectForFields).toHaveBeenCalledWith(groupedData);
	// 	});

	// 	it('should handle errors', async () => {
	// 		(XmlHelper.prototype.generateCustomObjectForFields as jest.Mock).mockRejectedValue(new Error('XML generation failed'));

	// 		const groupedData = {
	// 			Account: {
	// 				fields: ['Field1__c'],
	// 			},
	// 		};

	// 		await expect((service as any).processModifiedMetadata(groupedData)).rejects.toThrow('Failed to generate custom objects');
	// 	});
	// });

	describe('getChangedFiles', () => {
		beforeEach(() => {
			jest.resetAllMocks();
		});

		it('should return grouped and filtered files', async () => {
			const mockChangedFiles = [
				'force-app/main/default/classes/TestClass.cls',
				'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml'
			].join('\n');

			(execSync as jest.Mock).mockReturnValueOnce(mockChangedFiles);

			const result = await (service as any).getGitFiles('AM');

			expect(result).toEqual([
				'force-app/main/default/classes/TestClass.cls',
				'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml'
			]);
			expect(execSync).toHaveBeenCalledWith(
				'git diff --diff-filter=AM --name-only HEAD~1...HEAD',
				{ encoding: 'utf8' },
			);
		});

		it('should handle git command errors', async () => {
			(execSync as jest.Mock).mockImplementation(() => {
				throw new Error('Git command failed');
			});

			const result = await (service as any).getGitFiles('AM');

			expect(result).toEqual([]);
		});

		it('should respect configured source directory when filtering changed files', async () => {
			const customSourceService = new MDAPIService({
				...mockConfig,
				source: 'packages/core/main/default',
				baseBranch: 'origin/develop',
				targetBranch: 'feature/my-branch',
			});

			(execSync as jest.Mock).mockReturnValueOnce([
				'packages/core/main/default/classes/TestClass.cls',
				'force-app/main/default/classes/IgnoreMe.cls',
			].join('\n'));

			const result = await (customSourceService as any).getGitFiles('AM');

			expect(result).toEqual(['packages/core/main/default/classes/TestClass.cls']);
			expect(execSync).toHaveBeenCalledWith(
				'git diff --diff-filter=AM --name-only origin/develop...feature/my-branch',
				{ encoding: 'utf8' },
			);
		});

		it('should normalize source paths when filtering custom field changes', async () => {
			const customSourceService = new MDAPIService({
				...mockConfig,
				source: './force-app/main/default/',
			});

			(execSync as jest.Mock).mockReturnValueOnce([
				'./force-app/main/default/objects/Account/fields/Test__c.field-meta.xml',
				'force-app/main/default/classes/TestClass.cls',
			].join('\n'));

			const result = await (customSourceService as any).getGitFiles('AM');

			expect(result).toEqual([
				'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml',
				'force-app/main/default/classes/TestClass.cls',
			]);
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

			const result = await (service as any).getGitFiles('D');

			expect(result).toHaveLength(0);
		});
		it('should handle multiple deleted files', async () => {
			(execSync as jest.Mock).mockReturnValue([
				'force-app/main/default/classes/DeletedClass1.cls',
				'force-app/main/default/classes/DeletedClass2.cls'
			].join('\n'));

			const result = await (service as any).getGitFiles('D');

			expect(result).toHaveLength(2);
			expect(result).toContain('force-app/main/default/classes/DeletedClass1.cls');
			expect(result).toContain('force-app/main/default/classes/DeletedClass2.cls');
		});

		it('should return deleted files list', async () => {
			// Mock execSync to return a string as it would in reality
			(execSync as jest.Mock).mockReturnValue(
				'force-app/main/default/classes/DeletedClass.cls\n'
			);

			const result = await (service as any).getGitFiles('D');

			expect(result).toHaveLength(1);
			expect(result[0]).toBe('force-app/main/default/classes/DeletedClass.cls');
		});


	});
});
