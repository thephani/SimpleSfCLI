export const OUTPUT_DIR = '.simpleSfCli_out';

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tab.htm
// folder: 'compaonnetName
export const METADATA_TYPES: Record<string, string> = {
	
	// ArticleType: 'ArticleType',
	AccountingFieldMapping: 'AccountingFieldMapping',
	AccountingModelConfig: 'AccountingModelConfig',
	AccountRelationshipShareRule: 'AccountRelationshipShareRule',
	ActionableLIstDefinition: 'ActionableLIstDefinition',
	ActionLinkGroupTemplate: 'ActionLinkGroupTemplate',
	ActionPlanTemplate: 'ActionPlanTemplate',
	ApexEmailNotifications: 'ApexEmailNotifications',
	ApexTestSuite: 'ApexTestSuite',
	AppMenu: 'AppMenu',
	ApporvalProcess: 'ApporvalProcess',
	AssesmentQuestion: 'AssesmentQuestion',
	AssesmentQuestionSet: 'AssesmentQuestionSet',
	AssignmentRules: 'AssignmentRules',
	AuraDefinitionBundle: 'AuraDefinitionBundle',
	AutoResponseRules: 'AutoResponseRules',
	BatchProcessJobDefinition: 'BatchProcessJobDefinition',
	Bot: 'Bot',
	BotBlock: 'BotBlock',
	BotTemplate: 'BotTemplate',
	BotVersion: 'BotVersion',
	BrandingSet: 'BrandingSet',
	BusinessProcessGroup: 'BusinessProcessGroup',
	CallCenter: 'CallCenter',
	classes: 'ApexClass',
	components: 'ApexComponent',
	ConnectedApp: 'ConnectedApp',
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
	CustomApplicationComponent: 'CustomApplicationComponent',
	labels: 'CustomLabels',
	customMetadata: 'CustomMetadata',
	CustomObjectTranslation: 'CustomObjectTranslation',
	CustomPageWebLink: 'CustomPageWebLink',
	CustomPermission: 'CustomPermission',
	CustomSite: 'CustomSite',
	CustomTab: 'CustomTab',
	CustomValue: 'CustomValue',
	Dashboard: 'Dashboard',
	Document: 'Document',
	EmailTemplate: 'EmailTemplate',
	EmbeddedServiceConfig: 'EmbeddedServiceConfig',
	EntitlementProcess: 'EntitlementProcess',
	EntitlementTemplate: 'EntitlementTemplate',
	EscalationRules: 'EscalationRules',
	EventDelivery: 'EventDelivery',
	ExperienceBundle: 'ExperienceBundle',
	ExternalAuthIdentityProvider: 'ExternalAuthIdentityProvider',
	ExternalClientApplication: 'ExternalClientApplication',
	ExternalCredential: 'ExternalCredential',
	fields: 'CustomField',
	flexipages: 'FlexiPage',
	flow: 'Flow',
	flowDefinitions: 'FlowDefinition',
	FlowTest: 'FlowTest',
	GlobalPicklist: 'GlobalPicklist',
	GlobalPicklistValue: 'GlobalPicklistValue',
	GlobalValueSet: 'GlobalValueSet',
	GlobalValueSetTranslation: 'GlobalValueSetTranslation',
	Group: 'Group',
	HomePageComponent: 'HomePageComponent',
	HomePageLayout: 'HomePageLayout',
	Layout: 'Layout',
	Letterhead: 'Letterhead',
	lwc: 'LightningComponentBundle',
	Messagingchannel: 'Messagingchannel',
	MilestoneType: 'MilestoneType',
	NavigationMenu: 'NavigationMenu',
	NotificationTypeConfig: 'NotificationTypeConfig',
	pages: 'ApexPage',
	permissionSet: 'PermissionSet',
	PlatformCachePartition: 'PlatformCachePartition',
	PlatformEventChannel: 'PlatformEventChannel',
	PlatformEventChannelMember: 'PlatformEventChannelMember',
	PlatformEventSubscriberConfig: 'PlatformEventSubscriberConfig',
	profiles: 'Profile',
	queue: 'Queue',
	queueRoutingConfig: 'QueueRoutingConfig',
	quickAction: 'QuickAction',
	Report: 'Report',
	ReportType: 'ReportType',
	Role: 'Role',
	ServiceChannel: 'ServiceChannel',
	standardValueSet: 'StandardValueSet',
	standardValueSets: 'StandardValueSet',
	tab: 'CustomTab',
	triggers: 'ApexTrigger',
	workflows: 'Workflow',
	layouts: 'Layout',
	groups: 'Group',
	objects: 'CustomObject',
	
};

export const METADATA_EXTENSIONS: Record<string, string> = {
	'.cls': '',                            // ApexClass
	'.component': '',                      // ApexComponent
	'.conversationMessageDefinition-meta.xml': '', // ConversationMessageDefinition
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
	'.group-meta.xml': '',                 // Group
	'.object-meta.xml': '',                         // CustomObject
	'.layout-meta.xml': '',                         // Layout
	'.labels-meta.xml': '',                         // CustomLabels	
};

export const MEMBERTYPE_REGEX = {
	CUSTOM_FIELD: /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/,
} as const;
