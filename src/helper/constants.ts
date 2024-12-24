export const OUTPUT_DIR = '.simpleSfCli_out';

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tab.htm
export const METADATA_TYPES: Record<string, string> = {
	classes: 'ApexClass',
	triggers: 'ApexTrigger',
	pages: 'ApexPage',
	fields: 'CustomField',
	customMetadata: 'CustomMetadata',
	components: 'ApexComponent',
	workflows: 'Workflow',
	standardValueSets: 'StandardValueSet',
	flowDefinitions: 'FlowDefinition',
	flow: 'Flow',
	tab: 'CustomTab',
	flexipages: 'FlexiPage',
};

export const MEMBERTYPE_REGEX = {
	CUSTOM_FIELD: /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/,
} as const;
