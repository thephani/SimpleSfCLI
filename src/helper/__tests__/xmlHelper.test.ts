import { XmlHelper } from '../xmlHelper';
import builder from 'xmlbuilder';

jest.mock('xmlbuilder');

describe('xmlHelper', () => {
	describe('createPackageXml', () => {
		it('should generate valid package.xml', () => {
			const mockBuilder = {
				att: jest.fn().mockReturnThis(),
				ele: jest.fn().mockReturnThis(),
				end: jest.fn().mockReturnValue('<?xml version="1.0"?>'),
			};

			(builder.create as jest.Mock).mockReturnValue(mockBuilder);

			const metadataTypes = [
				{ name: 'ApexClass', members: ['TestClass'] },
				{ name: 'CustomField', members: ['Account.CustomField'] },
			];

			const xmlHelper = new XmlHelper();
			const result = xmlHelper.createPackageXml(metadataTypes);

			expect(builder.create).toHaveBeenCalledWith('Package', { encoding: 'UTF-8' });
			expect(mockBuilder.att).toHaveBeenCalledWith('xmlns', expect.any(String));
			expect(result).toBe('<?xml version="1.0"?>');
		});
	});

	describe('generateCustomObjectForFields', () => {
		it('should generate custom object XML', () => {
			const mockBuilder = {
				att: jest.fn().mockReturnThis(),
				ele: jest.fn().mockReturnThis(),
				end: jest.fn().mockReturnValue('<?xml version="1.0"?>'),
			};

			(builder.create as jest.Mock).mockReturnValue(mockBuilder);

			const groupedData = {
				Account: {
					fields: ['CustomField1', 'CustomField2'],
				},
			};

      const xmlHelper = new XmlHelper();
			xmlHelper.generateCustomObjectForFields(groupedData);

			expect(builder.create).toHaveBeenCalledWith('CustomObject', { encoding: 'UTF-8' });
		});
	});
});
