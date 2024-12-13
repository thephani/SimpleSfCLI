export const OUTPUT_DIR = '.simpleSfCli_out';

export const METADATA_TYPES: Record<string, string> = {
	classes: 'ApexClass',
	triggers: 'ApexTrigger',
	pages: 'ApexPage',
	fields: 'CustomField',
	customMetadata: 'CustomMetadata',
	components: 'ApexComponent',
	workflows: 'Workflow',
	standardValueSets: 'StandardValueSet',
};

export const MEMBERTYPE_REGEX = {
	CUSTOM_FIELD: /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/,
} as const;
