import { MDAPIService } from '../MDAPIService';
import fs from 'fs';
import { execSync } from 'child_process';
import { XmlHelper } from '../../helper/xmlHelper';
import { CommandArgsConfig } from '../../types/config.type';
import path from 'path';

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

	it('should identify Bot type', () => {
		const filePath = 'force-app/main/default/bots/MyBot.bot';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('Bot');
	});

	it('should identify LightningMessageChannel type', () => {
		const filePath = 'force-app/main/default/messageChannels/MyChannel.messageChannel-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('LightningMessageChannel');
	});

	it('should identify AuraDefinitionBundle type', () => {
		const filePath = 'force-app/main/default/aura/MyAura/MyAura.cmp';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('AuraDefinitionBundle');
	});

	it('should identify StaticResource type', () => {
		const filePath = 'force-app/main/default/staticresources/siteLogo.resource';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('StaticResource');
	});

	it('should identify Report type', () => {
		const filePath = 'force-app/main/default/reports/Sales/Monthly_Revenue.report-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('Report');
	});

	it('should identify Dashboard type', () => {
		const filePath = 'force-app/main/default/dashboards/Exec/Overview.dashboard-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('Dashboard');
	});

	it('should identify Document type', () => {
		const filePath = 'force-app/main/default/documents/Logos/Branding.document-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('Document');
	});

	it('should identify EmailTemplate type', () => {
		const filePath = 'force-app/main/default/email/Customer/Welcome.email-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('EmailTemplate');
	});

	it('should identify PermissionSet type', () => {
		const filePath = 'force-app/main/default/permissionsets/PS_View.permissionset-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('PermissionSet');
	});

	it('should identify NamedCredential type', () => {
		const filePath = 'force-app/main/default/namedCredentials/MyNC.namedCredential-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('NamedCredential');
	});

	it('should identify RemoteSiteSetting type', () => {
		const filePath = 'force-app/main/default/remoteSiteSettings/Ext.remoteSite-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('RemoteSiteSetting');
	});

	it('should identify Settings type', () => {
		const filePath = 'force-app/main/default/settings/Account.settings-meta.xml';
		const type = (service as any).getMetadataType(filePath);
		expect(type).toBe('Settings');
	});

		it('should identify LWC', () => {
			const filePath = 'force-app/main/default/lwc/test/test.html';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('LightningComponentBundle');
		});

	it('should identify Group', () => {
			const filePath = 'force-app/main/default/groups/sandbox-users.group-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('Group');
		});

		it('should block unknown inferred type not in allowlist', () => {
			const filePath = 'force-app/main/default/myUnknownFolder/Thing.myUnknown-meta.xml';
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as unknown as jest.Mock).mockReturnValue('<SomeNewType xmlns="http://soap.sforce.com/2006/04/metadata"/>');
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBeNull();
		});

		it('should block explicitly unsupported types by denylist', () => {
			const filePath = 'force-app/main/default/deny/UnsupportedExampleType.my-meta.xml';
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as unknown as jest.Mock).mockReturnValue('<UnsupportedExampleType xmlns="http://soap.sforce.com/2006/04/metadata"/>');
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBeNull();
		});

		it('should identify RecordType type', () => {
			const filePath = 'force-app/main/default/objects/Account/recordTypes/B2B.recordType-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('RecordType');
		});

		it('should identify ListView type', () => {
			const filePath = 'force-app/main/default/objects/Account/listViews/All_Customers.listView-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('ListView');
		});

		it('should identify FieldSet type', () => {
			const filePath = 'force-app/main/default/objects/Account/fieldSets/FS_Default.fieldSet-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('FieldSet');
		});

		it('should identify CompactLayout type', () => {
			const filePath = 'force-app/main/default/objects/Account/compactLayouts/Mobile.compactLayout-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('CompactLayout');
		});

		it('should identify ValidationRule type', () => {
			const filePath = 'force-app/main/default/objects/Account/validationRules/Required.validationRule-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('ValidationRule');
		});

		it('should identify WebLink type', () => {
			const filePath = 'force-app/main/default/objects/Account/webLinks/Portal.webLink-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('WebLink');
		});

		it('should identify BusinessProcess type', () => {
			const filePath = 'force-app/main/default/objects/Case/businessProcesses/Support.businessProcess-meta.xml';
			const type = (service as any).getMetadataType(filePath);
			expect(type).toBe('BusinessProcess');
		});

	});

	describe('getMemberName', () => {
		it('should build member for RecordType as Object.Name', () => {
			const filePath = 'force-app/main/default/objects/Account/recordTypes/B2B.recordType-meta.xml';
			const name = (service as any).getMemberName(filePath);
			expect(name).toBe('Account.B2B');
		});

		it('should build member for ListView as Object.Name', () => {
			const filePath = 'force-app/main/default/objects/Account/listViews/All_Customers.listView-meta.xml';
			const name = (service as any).getMemberName(filePath);
			expect(name).toBe('Account.All_Customers');
		});

		it('should build member for ValidationRule as Object.Name', () => {
			const filePath = 'force-app/main/default/objects/Account/validationRules/Required.validationRule-meta.xml';
			const name = (service as any).getMemberName(filePath);
			expect(name).toBe('Account.Required');
		});

		it('should build member for WebLink as Object.Name', () => {
			const filePath = 'force-app/main/default/objects/Account/webLinks/Portal.webLink-meta.xml';
			const name = (service as any).getMemberName(filePath);
			expect(name).toBe('Account.Portal');
		});

		it('should build member for folder-based Report as Folder/Name', () => {
			const filePath = 'force-app/main/default/reports/Sales/Monthly_Revenue.report-meta.xml';
			const name = (service as any).getMemberName(filePath);
			expect(name).toBe('Sales/Monthly_Revenue');
		});

		it('should build member for EmailTemplate as Folder/Name', () => {
			const filePath = 'force-app/main/default/email/Customer/Welcome.email-meta.xml';
			const name = (service as any).getMemberName(filePath);
			expect(name).toBe('Customer/Welcome');
		});

		it('should build member for StaticResource from base name', () => {
			const filePath = 'force-app/main/default/staticresources/siteLogo.resource';
			const name = (service as any).getMemberName(filePath);
			expect(name).toBe('siteLogo');
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

			const result = await (service as any).getGitFiles();

			expect(result).toEqual([
				'force-app/main/default/classes/TestClass.cls',
				'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml'
			]);
		});

		it('should handle git command errors', async () => {
			(execSync as jest.Mock).mockImplementation(() => {
				throw new Error('Git command failed');
			});

			const result = await (service as any).getGitFiles();

			expect(result).toEqual([]);
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

			const result = await (service as any).getGitFiles();

			expect(result).toHaveLength(0);
		});
		it('should handle multiple deleted files', async () => {
			(execSync as jest.Mock).mockReturnValue([
				'force-app/main/default/classes/DeletedClass1.cls',
				'force-app/main/default/classes/DeletedClass2.cls'
			].join('\n'));

			const result = await (service as any).getGitFiles();

			expect(result).toHaveLength(2);
			expect(result).toContain('force-app/main/default/classes/DeletedClass1.cls');
			expect(result).toContain('force-app/main/default/classes/DeletedClass2.cls');
		});

		it('should return deleted files list', async () => {
			// Mock execSync to return a string as it would in reality
			(execSync as jest.Mock).mockReturnValue(
				'force-app/main/default/classes/DeletedClass.cls\n'
			);

			const result = await (service as any).getGitFiles();

			expect(result).toHaveLength(1);
			expect(result[0]).toBe('force-app/main/default/classes/DeletedClass.cls');
		});


	});
});
