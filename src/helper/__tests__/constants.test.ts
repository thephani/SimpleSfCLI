import { MDAPIService } from '../../services/MDAPIService';
import { METADATA_EXTENSIONS, METADATA_TYPES } from '../constants';
import type { CommandArgsConfig } from '../../types/config.type';

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

describe('metadata constants coverage', () => {
	const service = new MDAPIService(mockConfig);
	const getMetadataType = (filePath: string): string | null =>
		(service as any).getMetadataType(filePath);
	const getMemberName = (filePath: string): string | null =>
		(service as any).getMemberName(filePath);

	const buildSamplePath = (folder: string): string => {
		switch (folder) {
			case 'fields':
				return 'force-app/main/default/objects/Account/fields/Test_Field__c.field-meta.xml';
			case 'objects':
				return 'force-app/main/default/objects/Account/Account.object-meta.xml';
			case 'lwc':
				return 'force-app/main/default/lwc/sampleComponent/sampleComponent.js';
			default:
				return `force-app/main/default/${folder}/SampleComponent-meta.xml`;
		}
	};

	describe('METADATA_TYPES', () => {
		it('has no duplicate folder keys after object evaluation', () => {
			const keys = Object.keys(METADATA_TYPES);
			expect(new Set(keys).size).toBe(keys.length);
		});

		it.each(Object.entries(METADATA_TYPES))(
			'maps "%s" to "%s" through getMetadataType',
			(folder, expectedType) => {
				expect(getMetadataType(buildSamplePath(folder))).toBe(expectedType);
			},
		);
	});

	describe('METADATA_EXTENSIONS', () => {
		it.each(Object.entries(METADATA_EXTENSIONS))(
			'strips "%s" from package members',
			(extension, replacement) => {
				const filePath = `force-app/main/default/classes/Sample${extension}`;
				expect(getMemberName(filePath)).toBe(`Sample${replacement}`);
			},
		);

		it('builds a dot-qualified member for custom fields', () => {
			expect(
				getMemberName(
					'force-app/main/default/objects/Account/fields/Test_Field__c.field-meta.xml',
				),
			).toBe('Account.Test_Field__c');
		});
	});
});
