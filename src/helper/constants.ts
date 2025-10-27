export const OUTPUT_DIR = '.simpleSfCli_out';

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tab.htm
export const METADATA_TYPES: Record<string, string> = {
	classes: 'ApexClass',
	components: 'ApexComponent',
	conversationMessageDefinitions: 'ConversationMessageDefinition',
	bots: 'Bot',
	messageChannels: 'LightningMessageChannel',
	customMetadata: 'CustomMetadata',
	fields: 'CustomField',
	flexipages: 'FlexiPage',
	flow: 'Flow',
	flowDefinitions: 'FlowDefinition',
	pages: 'ApexPage',
	profiles: 'Profile',
	standardValueSets: 'StandardValueSet',
	// Support both plural/singular just in case
	tabs: 'CustomTab',
	tab: 'CustomTab',
	triggers: 'ApexTrigger',
	workflows: 'Workflow',
	lwc: 'LightningComponentBundle',
	aura: 'AuraDefinitionBundle',
	layouts: 'Layout',
	objects: 'CustomObject',
	groups: 'Group',
	queues: 'Queue',
	apexEmailNotifications: 'ApexEmailNotifications',
	testSuites: 'ApexTestSuite',
	approvalProcesses: 'ApprovalProcess',
	assignmentRules: 'AssignmentRules',
	autoResponseRules: 'AutoResponseRules',
	connectedApps: 'ConnectedApp',
	applications: 'CustomApplication',
	staticresources: 'StaticResource',
	reports: 'Report',
	dashboards: 'Dashboard',
	documents: 'Document',
	email: 'EmailTemplate',
	labels: 'CustomLabels',
	permissionsets: 'PermissionSet',
	permissionSetGroups: 'PermissionSetGroup',
	namedCredentials: 'NamedCredential',
	remoteSiteSettings: 'RemoteSiteSetting',
	globalValueSets: 'GlobalValueSet',
	globalValueSetTranslations: 'GlobalValueSetTranslation',
	translations: 'Translations',
	reportTypes: 'ReportType',
	quickActions: 'QuickAction',
	cspTrustedSites: 'CspTrustedSite',
	networks: 'Network',
	sites: 'CustomSite',
	homePageLayouts: 'HomePageLayout',
	settings: 'Settings',
	contentassets: 'ContentAsset',
};

export const METADATA_EXTENSIONS: Record<string, string> = {
	'.cls': '',                            // ApexClass
	'.component': '',                      // ApexComponent
	'.conversationMessageDefinition-meta.xml': '', // ConversationMessageDefinition
	'.bot': '',                            // Bot
	'.messageChannel-meta.xml': '',        // LightningMessageChannel
	'.flexipage-meta.xml': '',             // FlexiPage
	'.flow-meta.xml': '',                  // Flow
	'.md-meta.xml': '',                    // CustomMetadata
	'.page': '',                           // ApexPage
	'.profile-meta.xml': '',               // Profile
	'.standardValueSet-meta.xml': '',      // StandardValueSet
	'.tab-meta.xml': '',                   // CustomTab
	'.trigger': '',                        // ApexTrigger
	'.workflow-meta.xml': '',              // Workflow
	'.html': '',                           // LightningComponentBundle
	'.js': '',                             // LightningComponentBundle
	'.js-meta.xml': '',					   // LightningComponentBundle
	'.css': '',                            // LightningComponentBundle
	// AuraDefinitionBundle
	'.cmp': '',
	'.cmp-meta.xml': '',
	'.app': '',
	'.evt': '',
	'.evt-meta.xml': '',
	'.design': '',
	'.design-meta.xml': '',
	'.auradoc': '',
	'.tokens': '',
	'.controller.js': '',
	'.helper.js': '',
	'.renderer.js': '',
	'.svg': '',
	'.group-meta.xml': '',                 // Group
	'.object-meta.xml': '',                // CustomObject
	'.layout-meta.xml': '',                // Layout
	'.queue-meta.xml': '',                 // Queue
	'.recordType-meta.xml': '',           // RecordType
	'.listView-meta.xml': '',             // ListView
	'.validationRule-meta.xml': '',       // ValidationRule
	'.webLink-meta.xml': '',              // WebLink
	'.notifications-meta.xml': '', // ApexEmailNotification	
	'.testSuite-meta.xml': '', // ApexTestSuite
	'.approvalProcess-meta.xml': '', // ApprovalProcess
	'.assignmentRules-meta.xml': '', // AssignmentRules
	'.autoResponseRules-meta.xml': '', // AutoResponseRules
	'.connectedApp-meta.xml': '', // ConnectedApp
	'.app-meta.xml': '', // CustomApplication
	// Folder-based types
	'.report-meta.xml': '',               // Report
	'.dashboard-meta.xml': '',            // Dashboard
	'.document-meta.xml': '',             // Document
	'.email-meta.xml': '',                // EmailTemplate
	'.email': '',                         // EmailTemplate (content file)
	// Resource-like
	'.resource': '',                      // StaticResource content
	'.resource-meta.xml': '',             // StaticResource
	'.asset': '',                         // ContentAsset content
	'.asset-meta.xml': '',                // ContentAsset
	// Admin/config
	'.labels-meta.xml': '',               // CustomLabels
	'.permissionset-meta.xml': '',        // PermissionSet
	'.permissionsetgroup-meta.xml': '',   // PermissionSetGroup
	'.namedCredential-meta.xml': '',      // NamedCredential
	'.remoteSite-meta.xml': '',           // RemoteSiteSetting
	'.globalValueSet-meta.xml': '',       // GlobalValueSet
	'.globalValueSetTranslation-meta.xml': '', // GlobalValueSetTranslation
	'.translation-meta.xml': '',          // Translations
	'.reportType-meta.xml': '',           // ReportType
	'.quickAction-meta.xml': '',          // QuickAction
	'.homePageLayout-meta.xml': '',       // HomePageLayout
	'.settings-meta.xml': '',             // Settings
	'.role-meta.xml': '',                 // Role
};

export const MEMBERTYPE_REGEX = {
	CUSTOM_FIELD: /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/,
	RECORD_TYPE: /objects\/([^/]+)\/recordTypes\/([^/]+)\.recordType-meta\.xml$/,
	LIST_VIEW: /objects\/([^/]+)\/listViews\/([^/]+)\.listView-meta\.xml$/,
	FIELD_SET: /objects\/([^/]+)\/fieldSets\/([^/]+)\.fieldSet-meta\.xml$/,
	COMPACT_LAYOUT: /objects\/([^/]+)\/compactLayouts\/([^/]+)\.compactLayout-meta\.xml$/,
	VALIDATION_RULE: /objects\/([^/]+)\/validationRules\/([^/]+)\.validationRule-meta\.xml$/,
	WEB_LINK: /objects\/([^/]+)\/webLinks\/([^/]+)\.webLink-meta\.xml$/,
	BUSINESS_PROCESS: /objects\/([^/]+)\/businessProcesses\/([^/]+)\.businessProcess-meta\.xml$/,
	SHARING_REASON: /objects\/([^/]+)\/sharingReasons\/([^/]+)\.sharingReason-meta\.xml$/,
} as const;

// Allowlist of supported metadata types.
// This is built from the known folder→type map plus object-child component types.
export const SUPPORTED_METADATA_TYPES: Set<string> = new Set<string>([
    ...Object.values(METADATA_TYPES),
    'CustomField',
    'RecordType',
    'ListView',
    'FieldSet',
    'CompactLayout',
    'ValidationRule',
    'WebLink',
    'BusinessProcess',
    'SharingReason',
]);

// Denylist: explicitly unsupported or to-be-ignored types.
// Populate from the official unsupported list as needed.
export const UNSUPPORTED_METADATA_TYPES: Set<string> = new Set<string>([
    // Example placeholder to validate logic; extend with real items from docs.
    'UnsupportedExampleType',
]);
