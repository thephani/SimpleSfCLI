import { MDAPIService } from '../MDAPIService';
import fs from 'fs';
import { execSync } from 'child_process';
import { XmlHelper } from '../../helper/xmlHelper';

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    readFile: jest.fn()
  },
  existsSync: jest.fn()
}));

jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

jest.mock('../../helper/xmlHelper');

describe('MDAPIService', () => {
  let mdapiService: MDAPIService;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    mockConfig = {
      sourceDir: 'force-app/main/default',
      targetDir: 'mdapi',
      excludeList: []
    };

    mdapiService = new MDAPIService(mockConfig);
  });

  describe('convertToMDAPI', () => {
    it('should successfully convert SFDX source to MDAPI format', async () => {
      // Mock git diff to return some changed files
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/classes/TestClass.cls\nforce-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml'
      );

      // Mock XmlHelper methods
      (XmlHelper.prototype.generateCustomObjectForFields as jest.Mock).mockResolvedValue(undefined);
      (XmlHelper.prototype.createPackageXml as jest.Mock).mockReturnValue('<?xml version="1.0" ?>');
      (XmlHelper.prototype.generatePackageMember as jest.Mock).mockReturnValue({
        members: ['TestMember']
      });

      // Mock file system operations
      (fs.promises.readFile as jest.Mock).mockResolvedValue('@isTest class TestClass {}');
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await mdapiService.convertToMDAPI([]);

      // Verify directory creation
      // expect(fs.promises.mkdir).toHaveBeenCalled([], { recursive: true });

      // Verify package.xml was generated
      expect(fs.promises.writeFile).toHaveBeenCalled();

      // Verify files were copied
      expect(fs.promises.copyFile).toHaveBeenCalled();

      // Verify test classes were identified
      expect(result).toContain('TestClass');
    });

    it('should handle empty git diff with no changes', async () => {
      (execSync as jest.Mock).mockReturnValue('');

      const result = await mdapiService.convertToMDAPI([]);

      expect(result).toEqual([]);
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should handle custom field changes and generate custom objects', async () => {
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml'
      );

      await mdapiService.convertToMDAPI([]);

      expect(XmlHelper.prototype.generateCustomObjectForFields).toHaveBeenCalled();
    });

    it('should respect exclude list', async () => {
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/classes/TestClass.cls'
      );

      await mdapiService.convertToMDAPI(['ApexClass']);

      // Verify package.xml was not generated for excluded type
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should handle errors during conversion', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Git command failed');
      });

      await expect(mdapiService.convertToMDAPI([]))
        .rejects
        .toThrow('MDAPI conversion failed');
    });
  });

  describe('file handling', () => {
    it('should correctly handle metadata files', async () => {
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/classes/TestClass.cls'
      );
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await mdapiService.convertToMDAPI([]);

      // Verify both main file and meta file were copied
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
    });

    it('should handle .md-meta.xml files correctly', async () => {
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/documents/TestDoc.md-meta.xml'
      );

      await mdapiService.convertToMDAPI([]);

      // Verify file was copied with correct name transformation
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        expect.stringContaining('TestDoc.md-meta.xml'),
        expect.stringContaining('TestDoc.md')
      );
    });
  });

  describe('test class detection', () => {
    it('should detect @isTest annotation', async () => {
      (fs.promises.readFile as jest.Mock).mockResolvedValue('@isTest class TestClass {}');
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/classes/TestClass.cls'
      );

      const result = await mdapiService.convertToMDAPI([]);

      expect(result).toContain('TestClass');
    });

    it('should detect testMethod keyword', async () => {
      (fs.promises.readFile as jest.Mock).mockResolvedValue('class TestClass { testMethod static void test() {} }');
      (execSync as jest.Mock).mockReturnValue(
        'force-app/main/default/classes/TestClass.cls'
      );

      const result = await mdapiService.convertToMDAPI([]);

      expect(result).toContain('TestClass');
    });
  });
});