import type { CommandArgsConfig } from './types/config.js';

const config: CommandArgsConfig = {
  // Default source directory for SFDX format
  source: 'force-app/main/default',
  
  // Output file for deployment
  output: 'deploy.zip',
  
  // Default environment
  env: 'SANDBOX',
  
  // Authentication tokens and credentials (initialized as undefined)
  accessToken: undefined,
  clientId: undefined,
  username: undefined,
  privateKey: undefined,
  instanceUrl: undefined,
  
  // Metadata types to exclude from deployment
  exclude: undefined,
  
  // Application information
  appVersion: '0.5.1',
  appDescription: 'Deploy your metadata in seconds',
  
  // Salesforce API version
  sfVersion: 'v60.0',
  
  // CLI information
  cliVersion: '0.6.0',
  cliOuputFolder: '.simpleSfCli_out',
  
  // Deployment options
  quickDeployId: undefined,
  testLevel: 'NoTestRun',
  
  // Test coverage configuration
  coverageJson: './ApexTestCoverage.json',
  runTests: []
};

export default config;