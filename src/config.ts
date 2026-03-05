import {
  BUILD_ROOT,
  DEFAULT_API_VERSION,
  DEFAULT_MAIN_ZIP,
  DEFAULT_PLAN_PATH,
  DEFAULT_SOURCE_ROOT,
  DEFAULT_TOON_ROOT,
} from './constants/metadata';

export const defaults = {
  sourceRoot: DEFAULT_SOURCE_ROOT,
  toonRoot: DEFAULT_TOON_ROOT,
  apiVersion: DEFAULT_API_VERSION,
  fromRef: 'HEAD~1',
  toRef: 'HEAD',
  planPath: DEFAULT_PLAN_PATH,
  buildRoot: BUILD_ROOT,
  outputZip: DEFAULT_MAIN_ZIP,
  env: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
  sfVersion: 'v62.0',
  testLevel: 'NoTestRun' as 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg',
};

export function defaultInstanceUrl(env: 'SANDBOX' | 'PRODUCTION'): string {
  return env === 'PRODUCTION' ? 'https://login.salesforce.com' : 'https://test.salesforce.com';
}
