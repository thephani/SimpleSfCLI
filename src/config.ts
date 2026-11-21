import fs from 'fs';
import path from 'path';
import type { CommandArgsConfig } from './types/config.type.js';

/** Reads the published package version so `--version` never drifts from package.json. */
function readPackageVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
    const { version } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
    return version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const config: CommandArgsConfig = {
  // Default source directory for SFDX format
  source: 'force-app/main/default',
  
  // Output file for deployment
  output: 'deploy.zip',
  
  // Default environment
  env: 'SANDBOX',

  // Default git comparison range
  baseBranch: 'HEAD~1',
  targetBranch: 'HEAD',
  
  // Authentication tokens and credentials (initialized as undefined)
  accessToken: undefined,
  clientId: undefined,
  username: undefined,
  privateKey: undefined,
  instanceUrl: 'https://test.salesforce.com',
  
  // Metadata types to exclude from deployment
  exclude: undefined,
  
  // Application information
  appVersion: '0.5.1',
  appDescription: 'Deploy your metadata in seconds',
  
  // Salesforce API version
  sfVersion: 'v62.0',
  
  // CLI information
  cliVersion: readPackageVersion(),
  cliOuputFolder: '.simpleSfCli_out',
  
  // Deployment options
  quickDeployId: undefined,
  manifest: undefined,
  testLevel: 'NoTestRun',
  
  // Test coverage configuration
  coverageJson: './ApexTestCoverage.json',
  runTests: [],
  pollInterval: 5000,
  maxPollAttempts: 120,

  // Deployment report output (disabled unless --reportFormat or --reportPath is provided)
  reportFormat: undefined,
  reportPath: './reports'
};

export default config;
