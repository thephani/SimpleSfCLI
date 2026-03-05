export const DEFAULT_TOON_ROOT = 'toon';
export const DEFAULT_SOURCE_ROOT = 'force-app/main/default';
export const DEFAULT_API_VERSION = '62.0';
export const BUILD_ROOT = '.simpleSfCli/build';
export const PLAN_ROOT = '.simpleSfCli/plans';
export const DEFAULT_PLAN_PATH = `${PLAN_ROOT}/plan.json`;
export const DEFAULT_MAIN_ZIP = 'deploy.zip';

export const METADATA_FILE_RULES = {
  ApexClass: { folder: 'classes', extension: '.cls', metaExtension: '.cls-meta.xml' },
  ApexTrigger: { folder: 'triggers', extension: '.trigger', metaExtension: '.trigger-meta.xml' },
  ApexPage: { folder: 'pages', extension: '.page', metaExtension: '.page-meta.xml' },
  ApexComponent: { folder: 'components', extension: '.component', metaExtension: '.component-meta.xml' },
  Flow: { folder: 'flows', extension: '.flow-meta.xml' },
  Layout: { folder: 'layouts', extension: '.layout-meta.xml' },
  FlexiPage: { folder: 'flexipages', extension: '.flexipage-meta.xml' },
  CustomMetadata: { folder: 'customMetadata', extension: '.md-meta.xml' },
  Profile: { folder: 'profiles', extension: '.profile-meta.xml' },
  PermissionSet: { folder: 'permissionsets', extension: '.permissionset-meta.xml' },
  StandardValueSet: { folder: 'standardValueSets', extension: '.standardValueSet-meta.xml' },
  Group: { folder: 'groups', extension: '.group-meta.xml' },
  CustomTab: { folder: 'tabs', extension: '.tab-meta.xml' },
} as const;

export const SUPPORTED_METADATA_TYPES = new Set<string>([
  'ApexClass',
  'ApexTrigger',
  'ApexPage',
  'ApexComponent',
  'LightningComponentBundle',
  'AuraDefinitionBundle',
  'CustomObject',
  'CustomField',
  'Flow',
  'Layout',
  'FlexiPage',
  'CustomMetadata',
  'Profile',
  'PermissionSet',
  'StandardValueSet',
  'Group',
  'CustomTab',
]);
