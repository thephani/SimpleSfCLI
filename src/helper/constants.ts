export const OUTPUT_DIR = '.simpleSfCli_out';

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tab.htm
// folder: 'compaonnetName
export const METADATA_TYPES: Record<string, string> = {
	
	// ArticleType: 'ArticleType',
	AccountingFieldMapping: 'AccountingFieldMapping',
	AccountingModelConfig: 'AccountingModelConfig',
	AccountRelationshipShareRule: 'AccountRelationshipShareRule',
	ActionableLIstDefinition: 'ActionableLIstDefinition',
	ActionableListDefinition: 'ActionableListDefinition',
	ActionLinkGroupTemplate: 'ActionLinkGroupTemplate',
	ActionPlanTemplate: 'ActionPlanTemplate',
	ApexEmailNotifications: 'ApexEmailNotifications',
	ApexTestSuite: 'ApexTestSuite',
	applications: 'CustomApplication',
	AppMenu: 'AppMenu',
	ApporvalProcess: 'ApporvalProcess',
	ApprovalProcess: 'ApprovalProcess',
	approvalProcesses: 'ApprovalProcess',
	AssesmentQuestion: 'AssesmentQuestion',
	AssessmentQuestion: 'AssessmentQuestion',
	AssesmentQuestionSet: 'AssesmentQuestionSet',
	AssessmentQuestionSet: 'AssessmentQuestionSet',
	AssignmentRules: 'AssignmentRules',
	assignmentRules: 'AssignmentRules',
	aura: 'AuraDefinitionBundle',
	AuraDefinitionBundle: 'AuraDefinitionBundle',
	AutoResponseRules: 'AutoResponseRules',
	autoResponseRules: 'AutoResponseRules',
	BatchProcessJobDefinition: 'BatchProcessJobDefinition',
	Bot: 'Bot',
	BotBlock: 'BotBlock',
	BotTemplate: 'BotTemplate',
	BotVersion: 'BotVersion',
	BrandingSet: 'BrandingSet',
	BusinessProcessGroup: 'BusinessProcessGroup',
	cachePartitions: 'PlatformCachePartition',
	CallCenter: 'CallCenter',
	classes: 'ApexClass',
	components: 'ApexComponent',
	ConnectedApp: 'ConnectedApp',
	connectedApps: 'ConnectedApp',
	ContentAsset: 'ContentAsset',
	ContentDocument: 'ContentDocument',
	ContentFolder: 'ContentFolder',
	ContentFolderLink: 'ContentFolderLink',
	ContentFolderMember: 'ContentFolderMember',
	ContentVersion: 'ContentVersion',
	conversationMessageDefinitions: 'ConversationMessageDefinition',
	CorsWhitelistOrigin: 'CorsWhitelistOrigin',
	CriteriaBasedSharingRule: 'CriteriaBasedSharingRule',
	CspTrustedSite: 'CspTrustedSite',
	CustomApplication: 'CustomApplication',
	customApplications: 'CustomApplication',
	CustomApplicationComponent: 'CustomApplicationComponent',
	labels: 'CustomLabels',
	customMetadata: 'CustomMetadata',
	CustomObjectTranslation: 'CustomObjectTranslation',
	CustomPageWebLink: 'CustomPageWebLink',
	CustomPermission: 'CustomPermission',
	customPermissions: 'CustomPermission',
	CustomSite: 'CustomSite',
	CustomTab: 'CustomTab',
	CustomValue: 'CustomValue',
	Dashboard: 'Dashboard',
	dashboards: 'Dashboard',
	Document: 'Document',
	duplicateRules: 'DuplicateRule',
	email: 'EmailTemplate',
	EmailTemplate: 'EmailTemplate',
	EmbeddedServiceConfig: 'EmbeddedServiceConfig',
	EntitlementProcess: 'EntitlementProcess',
	EntitlementTemplate: 'EntitlementTemplate',
	EscalationRules: 'EscalationRules',
	escalationRules: 'EscalationRules',
	EventDelivery: 'EventDelivery',
	ExperienceBundle: 'ExperienceBundle',
	experiences: 'ExperienceBundle',
	ExternalAuthIdentityProvider: 'ExternalAuthIdentityProvider',
	ExternalClientApplication: 'ExternalClientApplication',
	ExternalCredential: 'ExternalCredential',
	externalCredentials: 'ExternalCredential',
	fields: 'CustomField',
	flexipages: 'FlexiPage',
	flow: 'Flow',
	flows: 'Flow',
	flowDefinitions: 'FlowDefinition',
	FlowTest: 'FlowTest',
	GlobalPicklist: 'GlobalPicklist',
	GlobalPicklistValue: 'GlobalPicklistValue',
	GlobalValueSet: 'GlobalValueSet',
	globalValueSets: 'GlobalValueSet',
	GlobalValueSetTranslation: 'GlobalValueSetTranslation',
	Group: 'Group',
	HomePageComponent: 'HomePageComponent',
	HomePageLayout: 'HomePageLayout',
	Layout: 'Layout',
	Letterhead: 'Letterhead',
	lwc: 'LightningComponentBundle',
	matchingRules: 'MatchingRules',
	Messagingchannel: 'Messagingchannel',
	MessagingChannel: 'MessagingChannel',
	MilestoneType: 'MilestoneType',
	namedCredentials: 'NamedCredential',
	NavigationMenu: 'NavigationMenu',
	NotificationTypeConfig: 'NotificationTypeConfig',
	pages: 'ApexPage',
	permissionSet: 'PermissionSet',
	permissionsets: 'PermissionSet',
	PlatformCachePartition: 'PlatformCachePartition',
	PlatformEventChannel: 'PlatformEventChannel',
	PlatformEventChannelMember: 'PlatformEventChannelMember',
	PlatformEventSubscriberConfig: 'PlatformEventSubscriberConfig',
	profiles: 'Profile',
	queue: 'Queue',
	queues: 'Queue',
	queueRoutingConfig: 'QueueRoutingConfig',
	quickAction: 'QuickAction',
	quickActions: 'QuickAction',
	Report: 'Report',
	reports: 'Report',
	ReportType: 'ReportType',
	reportTypes: 'ReportType',
	Role: 'Role',
	roles: 'Role',
	ServiceChannel: 'ServiceChannel',
	sharingRules: 'SharingRules',
	standardValueSet: 'StandardValueSet',
	standardValueSets: 'StandardValueSet',
	staticresources: 'StaticResource',
	tab: 'CustomTab',
	tabs: 'CustomTab',
	triggers: 'ApexTrigger',
	weblinks: 'CustomPageWebLink',
	workflows: 'Workflow',
	layouts: 'Layout',
	groups: 'Group',
	objects: 'CustomObject',
	
};

export const METADATA_EXTENSIONS: Record<string, string> = {
	'.cls-meta.xml': '',                   // ApexClass companion
	'.cls': '',                            // ApexClass
	'.component-meta.xml': '',             // ApexComponent companion
	'.component': '',                      // ApexComponent
	'.conversationMessageDefinition-meta.xml': '', // ConversationMessageDefinition
	'.flexipage-meta.xml': '',             // FlexiPage
	'.flow-meta.xml': '',                  // Flow
	'.flowDefinition-meta.xml': '',        // FlowDefinition
	'.md-meta.xml': '',                    // CustomMetadata
	'.page-meta.xml': '',                  // ApexPage companion
	'.page': '',                           // ApexPage
	'.profile-meta.xml': '',               // Profile
	'.permissionset-meta.xml': '',         // PermissionSet
	'.standardValueSet-meta.xml': '',      // StandardValueSet
	'.tab-meta.xml': '',                   // CustomTab
	'.trigger-meta.xml': '',               // ApexTrigger companion
	'.trigger': '',                        // ApexTrigger
	'.workflow-meta.xml': '',              // Workflow
	'.html': '',                           // LightningComponentBundle
	'.js-meta.xml': '',                    // LightningComponentBundle
	'.js': '',                             // LightningComponentBundle
	'.css': '',                            // LightningComponentBundle
	'.group-meta.xml': '',                 // Group
	'.object-meta.xml': '',                // CustomObject
	'.layout-meta.xml': '',                // Layout
	'.labels-meta.xml': '',                // CustomLabels
	'.queue-meta.xml': '',                 // Queue
	'.quickAction-meta.xml': '',           // QuickAction
	'.customPermission-meta.xml': '',      // CustomPermission
	'.role-meta.xml': '',                  // Role
	'.report-meta.xml': '',                // Report
	'.reportType-meta.xml': '',            // ReportType
	'.dashboard-meta.xml': '',             // Dashboard
	'.email-meta.xml': '',                 // EmailTemplate companion
	'.email': '',                          // EmailTemplate
	'.resource-meta.xml': '',              // StaticResource companion
	'.resource': '',                       // StaticResource
	'.weblink-meta.xml': '',               // CustomPageWebLink
	'.approvalProcess-meta.xml': '',       // ApprovalProcess
	'.globalValueSet-meta.xml': '',        // GlobalValueSet
	'.app-meta.xml': '',                   // CustomApplication / AuraDefinitionBundle
	'.app': '',                            // AuraDefinitionBundle
	'.connectedApp-meta.xml': '',          // ConnectedApp
	'.namedCredential-meta.xml': '',       // NamedCredential
	'.externalCredential-meta.xml': '',    // ExternalCredential
	'.cachePartition-meta.xml': '',        // PlatformCachePartition
	'.sharingRules-meta.xml': '',          // SharingRules
	'.duplicateRule-meta.xml': '',         // DuplicateRule
	'.matchingRule-meta.xml': '',          // MatchingRules
	'.matchingRules-meta.xml': '',         // MatchingRules
	'.assignmentRules-meta.xml': '',       // AssignmentRules
	'.autoResponseRules-meta.xml': '',     // AutoResponseRules
	'.escalationRules-meta.xml': '',       // EscalationRules
	'.cmp-meta.xml': '',                   // AuraDefinitionBundle
	'.cmp': '',                            // AuraDefinitionBundle
	'.evt-meta.xml': '',                   // AuraDefinitionBundle
	'.evt': '',                            // AuraDefinitionBundle
	'.intf-meta.xml': '',                  // AuraDefinitionBundle
	'.intf': '',                           // AuraDefinitionBundle
	'.tokens-meta.xml': '',                // AuraDefinitionBundle
	'.tokens': '',                         // AuraDefinitionBundle
	'.auradoc': '',                        // AuraDefinitionBundle
	'.design': '',                         // AuraDefinitionBundle
	'.svg': '',                            // AuraDefinitionBundle / LightningComponentBundle
	'.site-meta.xml': '',                  // ExperienceBundle / CustomSite
};

export const MEMBERTYPE_REGEX = {
	CUSTOM_FIELD: /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/,
	VALIDATION_RULE: /objects\/([^/]+)\/validationRules\/([^/]+)\.validationRule-meta\.xml$/,
	RECORD_TYPE: /objects\/([^/]+)\/recordTypes\/([^/]+)\.recordType-meta\.xml$/,
	LIST_VIEW: /objects\/([^/]+)\/listViews\/([^/]+)\.listView-meta\.xml$/,
	WEB_LINK: /objects\/([^/]+)\/webLinks\/([^/]+)\.webLink-meta\.xml$/,
	COMPACT_LAYOUT: /objects\/([^/]+)\/compactLayouts\/([^/]+)\.compactLayout-meta\.xml$/,
	BUSINESS_PROCESS: /objects\/([^/]+)\/businessProcesses\/([^/]+)\.businessProcess-meta\.xml$/,
	FIELD_SET: /objects\/([^/]+)\/fieldSets\/([^/]+)\.fieldSet-meta\.xml$/,
} as const;

export type CustomObjectChildFolder =
	| 'fields'
	| 'validationRules'
	| 'recordTypes'
	| 'listViews'
	| 'webLinks'
	| 'compactLayouts'
	| 'businessProcesses'
	| 'fieldSets';

export interface CustomObjectChildConfig {
	folder: CustomObjectChildFolder;
	typeName: string;
	extension: string;
	regex: RegExp;
}

export const CUSTOM_OBJECT_CHILDREN: readonly CustomObjectChildConfig[] = [
	{
		folder: 'fields',
		typeName: 'CustomField',
		extension: '.field-meta.xml',
		regex: MEMBERTYPE_REGEX.CUSTOM_FIELD,
	},
	{
		folder: 'validationRules',
		typeName: 'ValidationRule',
		extension: '.validationRule-meta.xml',
		regex: MEMBERTYPE_REGEX.VALIDATION_RULE,
	},
	{
		folder: 'recordTypes',
		typeName: 'RecordType',
		extension: '.recordType-meta.xml',
		regex: MEMBERTYPE_REGEX.RECORD_TYPE,
	},
	{
		folder: 'listViews',
		typeName: 'ListView',
		extension: '.listView-meta.xml',
		regex: MEMBERTYPE_REGEX.LIST_VIEW,
	},
	{
		folder: 'webLinks',
		typeName: 'WebLink',
		extension: '.webLink-meta.xml',
		regex: MEMBERTYPE_REGEX.WEB_LINK,
	},
	{
		folder: 'compactLayouts',
		typeName: 'CompactLayout',
		extension: '.compactLayout-meta.xml',
		regex: MEMBERTYPE_REGEX.COMPACT_LAYOUT,
	},
	{
		folder: 'businessProcesses',
		typeName: 'BusinessProcess',
		extension: '.businessProcess-meta.xml',
		regex: MEMBERTYPE_REGEX.BUSINESS_PROCESS,
	},
	{
		folder: 'fieldSets',
		typeName: 'FieldSet',
		extension: '.fieldSet-meta.xml',
		regex: MEMBERTYPE_REGEX.FIELD_SET,
	},
] as const;
