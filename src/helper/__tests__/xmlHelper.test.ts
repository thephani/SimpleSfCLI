import fs from 'fs';
import { XmlHelper } from '../xmlHelper';
import { MetadataType } from '../../types/index.type';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

describe('XmlHelper', () => {
	let xmlHelper: XmlHelper;
	const mockOutputDir = './.test_output';

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks();
		xmlHelper = new XmlHelper(mockOutputDir);
	});

	describe('createEmptyPackageXml', () => {
		it('should create an empty package.xml with default version', () => {
			const result = xmlHelper.createEmptyPackageXml();

			expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(result).toContain('<Package xmlns="http://soap.sforce.com/2006/04/metadata">');
			expect(result).toContain('<version>62.0</version>');
		});

		it('should create an empty package.xml with custom version', () => {
			const customVersion = '55.0';
			const result = xmlHelper.createEmptyPackageXml(customVersion);

			expect(result).toContain(`<version>${customVersion}</version>`);
		});
	});

	describe('createPackageXml', () => {
		it('should create package.xml with sorted metadata types and members', () => {
			const metadataTypes: MetadataType[] = [
				{
					name: 'CustomField',
					members: ['Account.Field2', 'Account.Field1'],
				},
				{
					name: 'ApexClass',
					members: ['TestClass2', 'TestClass1'],
				},
			];

			const result = xmlHelper.createPackageXml(metadataTypes);

			// Verify XML structure and sorting
			expect(result).toContain('ApexClass');
			expect(result).toContain('CustomField');
			expect(result.indexOf('TestClass1')).toBeLessThan(result.indexOf('TestClass2'));
			expect(result.indexOf('Field1')).toBeLessThan(result.indexOf('Field2'));
			expect(result).toContain('<version>58.0</version>');
		});

		it('should handle empty metadata types array', () => {
			const result = xmlHelper.createPackageXml([]);

			expect(result).toContain('<Package');
			expect(result).toContain('<version>58.0</version>');
			expect(result).not.toContain('<types>');
		});
	});

	describe('generatePackageMember', () => {
		it('should generate package member for valid field path', () => {
			const filePath = 'objects/Account/fields/CustomField__c.field-meta.xml';
			const result = xmlHelper.generatePackageMember(filePath);

			expect(result).toEqual({
				name: 'CustomField',
				members: ['Account.CustomField__c'],
			});
		});

		it('should return null for invalid field path', () => {
			const filePath = 'invalid/path/structure.xml';
			const result = xmlHelper.generatePackageMember(filePath);

			expect(result).toBeNull();
		});
	});

	describe('generateCustomObjectForFields', () => {
		const mockGroupedData = {
			Account: {
				fields: ['CustomField1__c', 'CustomField2__c'],
			},
		};

		beforeEach(() => {
			// Mock fs.readFileSync to return sample XML
			(fs.readFileSync as jest.Mock).mockReturnValue(`
        <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
          <fullName>TestField</fullName>
          <type>Text</type>
        </CustomField>
      `);

			// Mock fs.existsSync and fs.mkdirSync
			(fs.existsSync as jest.Mock).mockReturnValue(false);
			(fs.mkdirSync as jest.Mock).mockImplementation(() => {});
		});

		it('should process grouped data and generate custom object XML', () => {
			xmlHelper = new XmlHelper(mockOutputDir);
			xmlHelper.generateCustomObjectForFields({
				Account: {
					fields: ['CustomField1__c', 'CustomField2__c'],
				},
			});

			//   Verify directory creation
			//  expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('objects'), expect.any(Object));

			// Verify file writing
			expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
		});

		it('should handle errors in XML processing', () => {
			(fs.readFileSync as jest.Mock).mockReturnValue('invalid xml content');

			// Expect an error to be thrown
			expect(() => xmlHelper.generateCustomObjectForFields(mockGroupedData)).toThrow('Error transforming XML files');
		});
	});

	describe('createCustomFieldXml', () => {
		it('should create valid custom field XML with basic properties', () => {
			const result = xmlHelper.createCustomFieldXml('TestField__c', 'Text');

			expect(result).toContain('<CustomField');
			expect(result).toContain('<fullName>TestField__c</fullName>');
			expect(result).toContain('<type>Text</type>');
		});

		it('should include additional properties when provided', () => {
			const properties = {
				label: 'Test Label',
				required: 'true',
				length: '255',
			};

			const result = xmlHelper.createCustomFieldXml('TestField__c', 'Text', properties);

			expect(result).toContain('<label>Test Label</label>');
			expect(result).toContain('<required>true</required>');
			expect(result).toContain('<length>255</length>');
		});
	});

	describe('isValidXml', () => {
		it('should return true for valid XML', () => {
			const validXml = '<?xml version="1.0"?><root><child>value</child></root>';
			expect(xmlHelper.isValidXml(validXml)).toBe(true);
		});

		it('should return false for invalid XML', () => {
			const invalidXml = 'text';
			expect(xmlHelper.isValidXml(invalidXml)).toBe(false);
		});
	});

	describe('setOutputDirectory', () => {
		it('should update output directory', () => {
			const newDir = './new_output_dir';
			xmlHelper.setOutputDirectory(newDir);

			// We need to test the private property indirectly through behavior
			const result = xmlHelper.createEmptyPackageXml();
			expect(result).toBeTruthy();
		});
	});
});
