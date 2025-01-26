export const OUTPUT_DIR = '.simpleSfCli_out';

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tab.htm
export const METADATA_TYPES: Record<string, string> = {
	classes: 'ApexClass',
	components: 'ApexComponent',
	conversationMessageDefinitions: 'ConversationMessageDefinition',
	customMetadata: 'CustomMetadata',
	fields: 'CustomField',
	flexipages: 'FlexiPage',
	flow: 'Flow',
	flowDefinitions: 'FlowDefinition',
	pages: 'ApexPage',
	profiles: 'Profile',
	standardValueSets: 'StandardValueSet',
	tab: 'CustomTab',
	triggers: 'ApexTrigger',
	workflows: 'Workflow',
	lwc: 'LightningComponentBundle',
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
};

export const MEMBERTYPE_REGEX = {
	CUSTOM_FIELD: /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/,
} as const;
