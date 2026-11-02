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

		it('maps labels correctly', () => {
			expect(getMetadataType('force-app/main/default/labels/SampleComponent-meta.xml')).toBe('CustomLabels');
		});

		it('supports corrected spellings while preserving legacy typo keys (F8)', () => {
			expect(METADATA_TYPES.ApprovalProcess).toBe('ApprovalProcess');
			expect(METADATA_TYPES.ApporvalProcess).toBe('ApporvalProcess');
			expect(METADATA_TYPES.AssessmentQuestion).toBe('AssessmentQuestion');
			expect(METADATA_TYPES.AssesmentQuestion).toBe('AssesmentQuestion');
			expect(METADATA_TYPES.AssessmentQuestionSet).toBe('AssessmentQuestionSet');
			expect(METADATA_TYPES.AssesmentQuestionSet).toBe('AssesmentQuestionSet');
			expect(METADATA_TYPES.ActionableListDefinition).toBe('ActionableListDefinition');
			expect(METADATA_TYPES.ActionableLIstDefinition).toBe('ActionableLIstDefinition');
			expect(METADATA_TYPES.MessagingChannel).toBe('MessagingChannel');
			expect(METADATA_TYPES.Messagingchannel).toBe('Messagingchannel');
		});

		it('maps standard plural SFDX folders to their Metadata API types (F8)', () => {
			const expectedMappings: Record<string, string> = {
				permissionsets: 'PermissionSet',
				flows: 'Flow',
				queues: 'Queue',
				quickActions: 'QuickAction',
				customPermissions: 'CustomPermission',
				staticresources: 'StaticResource',
				aura: 'AuraDefinitionBundle',
				roles: 'Role',
				reports: 'Report',
				reportTypes: 'ReportType',
				dashboards: 'Dashboard',
				email: 'EmailTemplate',
				weblinks: 'CustomPageWebLink',
				tabs: 'CustomTab',
				namedCredentials: 'NamedCredential',
				externalCredentials: 'ExternalCredential',
				globalValueSets: 'GlobalValueSet',
				customApplications: 'CustomApplication',
				applications: 'CustomApplication',
				connectedApps: 'ConnectedApp',
				cachePartitions: 'PlatformCachePartition',
				sharingRules: 'SharingRules',
				duplicateRules: 'DuplicateRule',
				matchingRules: 'MatchingRules',
				assignmentRules: 'AssignmentRules',
				autoResponseRules: 'AutoResponseRules',
				escalationRules: 'EscalationRules',
				experiences: 'ExperienceBundle',
			};

			for (const [folder, expectedType] of Object.entries(expectedMappings)) {
				expect(METADATA_TYPES[folder]).toBe(expectedType);
				expect(getMetadataType(`force-app/main/default/${folder}/SampleItem`)).toBe(expectedType);
			}
		});
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

		it('resolves decomposed CustomObject child types and dot-qualified members (F10)', () => {
			const cases = [
				{
					path: 'force-app/main/default/objects/Account/validationRules/Require_Phone.validationRule-meta.xml',
					type: 'ValidationRule',
					member: 'Account.Require_Phone',
				},
				{
					path: 'force-app/main/default/objects/Account/recordTypes/Enterprise.recordType-meta.xml',
					type: 'RecordType',
					member: 'Account.Enterprise',
				},
				{
					path: 'force-app/main/default/objects/Account/listViews/All_Accounts.listView-meta.xml',
					type: 'ListView',
					member: 'Account.All_Accounts',
				},
				{
					path: 'force-app/main/default/objects/Account/webLinks/Billing_Link.webLink-meta.xml',
					type: 'WebLink',
					member: 'Account.Billing_Link',
				},
				{
					path: 'force-app/main/default/objects/Account/compactLayouts/Account_Compact.compactLayout-meta.xml',
					type: 'CompactLayout',
					member: 'Account.Account_Compact',
				},
				{
					path: 'force-app/main/default/objects/Opportunity/businessProcesses/B2B_Sales.businessProcess-meta.xml',
					type: 'BusinessProcess',
					member: 'Opportunity.B2B_Sales',
				},
				{
					path: 'force-app/main/default/objects/Account/fieldSets/Summary_Fields.fieldSet-meta.xml',
					type: 'FieldSet',
					member: 'Account.Summary_Fields',
				},
			];

			for (const { path: filePath, type, member } of cases) {
				expect(getMetadataType(filePath)).toBe(type);
				expect(getMemberName(filePath)).toBe(member);
			}
		});

		it('resolves bundle member names for lwc, aura, and experiences (F11)', () => {
			expect(
				getMemberName('force-app/main/default/lwc/myLwc/myLwc.js'),
			).toBe('myLwc');
			expect(
				getMemberName('force-app/main/default/aura/myAura/myAuraController.js'),
			).toBe('myAura');
			expect(
				getMemberName('force-app/main/default/experiences/customerPortal/views/home.json'),
			).toBe('customerPortal');
		});
	});
});
