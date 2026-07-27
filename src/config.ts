import type { CommandArgsConfig } from './types/config.type.js';

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
  sfVersion: 'v60.0',
  
  // CLI information
  cliVersion: '2.7.5',
  cliOuputFolder: '.simpleSfCli_out',
  
  // Deployment options
  quickDeployId: undefined,
  manifest: undefined,
  testLevel: 'NoTestRun',
  
  // Test coverage configuration
  coverageJson: './ApexTestCoverage.json',
  runTests: []
};

export default config;
