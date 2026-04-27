# Simple SF CLI

[![NPM Version](https://img.shields.io/npm/v/simple-sf-cli.svg)](https://www.npmjs.com/package/simple-sf-cli)
[![Build Status](https://github.com/thephani/SimpleSfCLI/actions/workflows/npm-package.yml/badge.svg)](https://github.com/thephani/SimpleSfCLI/actions/workflows/npm-package.yml)
[![Downloads](https://img.shields.io/npm/dm/simple-sf-cli.svg)](https://www.npmjs.com/package/simple-sf-cli)
[![License](https://img.shields.io/npm/l/simple-sf-cli.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

> 🚀 Lightning-fast Salesforce DX metadata deployment tool - Deploy in 5-7 seconds without Salesforce CLI

[![User Feedback](https://img.shields.io/badge/Feedback-Share_Thoughts-green?logo=google-forms)](https://forms.gle/6K7nzE1Xrh5GVJvG7)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [What's New](#whats-new)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication Setup](#authentication-setup)
- [Usage](#usage)
- [Command Options](#command-options)
- [Deployment Modes](#deployment-modes)
- [Configuration](#configuration)
- [CI/CD Integration](#cicd-integration)
- [Development](#development)
- [Contributing](#contributing)
- [Documentation](#documentation)

---

## Overview

**Simple SF CLI** is a lightweight, high-performance Node.js command-line tool (19 KB package, ~81 KB unpacked) designed to streamline your Salesforce DX workflows. It converts, packages, and deploys SFDX projects to Salesforce in record time (5-7 seconds) without requiring Salesforce CLI or additional plugins.

### Key Advantages

- ⚡ **Blazing Fast**: Kick start your Deployment job in SFDX projects with in 6-8 seconds
- 🚫 **No Salesforce CLI Required**: Works independently uses salesforce metadata API
- 💎 **Zero Installation Overhead**: Use directly with `npx` or install locally
- 🔧 **Custom Built**: Only 4 core dependencies with full control
- 🤝 **CI/CD Ready**: Seamless integration with modern development pipelines like Github, Bitbucket

---

## Features

### Core Functionality

- **⚡ Lightning-Fast Deployments**: Push SFDX projects to Sandbox or Production faster than Salesforce CLI installation
- **📄 Automated MDAPI Conversion**: Converts SFDX metadata to Metadata API format for streamlined deployments
- **✂️ Selective Deployments**: Respect `.forceignore` and optionally exclude specific metadata types
- **🔄 Delta Deployments**: Compare and deploy changes between branches
- **🚀 Quick Deploy**: Use validated deployment IDs for instant deployments
- **🧪 Test Integration**: Support for various test levels (NoTestRun, RunSpecifiedTests, RunLocalTests)
- **📋 Comprehensive Logging**: Detailed error tracking with console tables for failed tests and components
- **🔒 JWT Authentication**: Secure token-based authentication without password prompts

### Supported Metadata Types

The tool supports extensive Salesforce metadata types including but not limited to:

**Custom Metadata:**
- ApexClasses, ApexComponents, ApexPages, ApexTriggers
- CustomObjects, CustomFields, CustomLabels
- Flows, FlowDefinitions
- LWC Lightning Components, Aura Components
- Profiles, PermissionSets, Queues
- Reports, ReportsTypes
- Visualforce Pages, Visualforce Components
- CustomTabs, QuickActions, ActionLinkGroupTemplates
- And 50+ more metadata types

See the [Complete Metadata Reference](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tab.htm) for full details.

---

## What's New

### 2.7.4 - 2026-04-27

- Fixed field-only delta deployments so changed fields are declared as `CustomField` members, not parent `CustomObject` members.
- Fixed `package.xml` generation for custom field deltas by reading the field metadata `<fullName>` and matching the manifest member to the generated MDAPI object payload.
- Prevented deployment failures such as `Must specify a non-empty label for the CustomObject` and `Not in package.xml` when only a custom field changes.
- Confirmed JWT authentication stores the returned Salesforce access token and instance URL on shared runtime config so deploy and status polling calls reuse the authenticated session.
- Added `auth:token` for explicit token export to JSON stdout or a protected local file.

### 2.7.x - 2026-04-07

- Added GitHub and Bitbucket pull request branch detection using CI environment variables.
- Prefer PR base and target branches from CI metadata before falling back to git inference. 
- Removed the `/bin/zsh` dependency from PR base detection so Linux and CI runners do not error on missing shell paths.
- Added release documentation for the metadata delta and package-generation fixes shipped today.
- Clarified PR-style delta comparison behavior in the release log.
- Fixed custom field detection for normalized source paths and local working tree changes.
- Improved delta collection so PR deployments can include unstaged, staged, and untracked metadata.
- Removed empty metadata sections from generated `package.xml` output.

Full release notes: [CHANGELOG.md](CHANGELOG.md)

---

## Prerequisites

Before using `simple-sf-cli`, ensure you meet the following requirements:

### 1. Generate Private Key and Self-Signed Certificate

You need a private key and self-signed certificate for JWT-based authentication.

```bash
# Generate private key (2048-bit)
openssl genrsa -out server.key 2048

# Generate self-signed certificate
openssl req -new -x509 -key server.key -out server.crt -days 365
```

**Note:** Store these securely and never commit them to version control.

### 2. Create Connected App in Salesforce

1. Navigate to **Setup** → **App Manager** → **New Connected App**
2. Enter:
   - **Connected App Name**: SimpleSFCLI
   - **Contact Email**: Your email address
3. Under **API (Enable OAuth Settings)**:
   - ✅ Enable OAuth Settings
   - **Callback URL**: `http://localhost`
   - **Selected OAuth Scopes**: 
     - ✅ Access and manage your data (api)
     - ✅ Perform requests at any time (refresh_token, offline_access)
4. Click **Save**
5. Copy the **Consumer Key** (this is your Client ID)
6. Upload the `server.crt` certificate you generated in step 1

For detailed instructions, see [Salesforce JWT Authentication Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_key_and_cert.htm).

> **Important:** You do NOT need Salesforce CLI installed to complete these steps or use Simple SF CLI.

---

## Installation

### Option 1: Global Installation (Recommended for Repeated Use)

Install globally via NPM for consistent access:

```bash
npm install -g simple-sf-cli
```

### Option 2: Local Installation

Add to your project's package.json:

```json
{
  "scripts": {
    "deploy:sandbox": "simple-sf-cli -u $USER -c $CLIENT_ID -k ./server.key --env SANDBOX",
    "deploy:prod": "simple-sf-cli -u $USER -c $CLIENT_ID -k ./server.key --env PRODUCTION"
  }
}
```

```bash
npm install simple-sf-cli
```

### Option 3: Zero Installation (Use with npx)

No installation needed - execute directly from the web:

```bash
npx simple-sf-cli --help
```

---

## Quick Start

### First Deployment

```bash
simpleSfCli \
    --username yourSalesforceUser@example.com \
    --clientId yourClientIdFromConnectedApp \
    --privateKey ./server.key \
    --env SANDBOX
```

### What Happens?

1. **Authentication**: JWT token is generated and authenticated with Salesforce
2. **Conversion**: SFDX metadata is converted to MDAPI format
3. **Packaging**: Files are organized into a deployable package
4. **Deployment**: Package is uploaded to Salesforce via Metadata API
5. **Progress**: Real-time deployment status is displayed
6. **Results**: Success or failure with detailed error tables

---

## Authentication Setup

### Environment Variables (Recommended)

For CI/CD pipelines, use shell environment variables to avoid hardcoding credentials, then pass them into CLI flags:

```bash
# Salesforce credentials
export SF_USERNAME="yourUser@example.com"
export SF_CLIENT_ID="yourClientId"
export SF_PRIVATE_KEY_PATH="./server.key"

# Deployment environment
export SF_ENV="SANDBOX"  # or PRODUCTION

# Optional: Set deployment options used by your shell scripts
export SF_SOURCE="force-app/main/default"
export SF_EXCLUDE="Profile,NamedCredential,CustomMetadata"
```

Use a project-level `.forceignore` file to exclude files or folders from deployment packaging:

```text
profiles/**
namedCredentials/**
labels/CustomLabels.labels-meta.xml
```

Patterns can be relative to your `--source` directory. Source-prefixed entries such as `force-app/main/default/labels/CustomLabels.labels-meta.xml` are also accepted.

### Local Usage

Simply pass credentials as command-line arguments:

```bash
simpleSfCli \
    --username "$SF_USERNAME" \
    --clientId "$SF_CLIENT_ID" \
    --privateKey "$SF_PRIVATE_KEY_PATH" \
    --env "$SF_ENV"
```

### Export an Access Token

Use `auth:token` when another local process, script, or cron job needs a short-lived Salesforce access token. The normal deploy flow keeps tokens in memory and does not print them.

```bash
simpleSfCli auth:token \
    --username "$SF_USERNAME" \
    --clientId "$SF_CLIENT_ID" \
    --privateKey "$SF_PRIVATE_KEY_PATH" \
    --env SANDBOX \
    --output .simpleSfCli_auth.json
```

The output file is written with `0600` permissions and contains:

```json
{
  "accessToken": "00D...",
  "instanceUrl": "https://your-org.my.salesforce.com",
  "issuedAt": "2026-04-27T20:00:00.000Z",
  "username": "yourUser@example.com"
}
```

Pass `--json` to print the same payload to stdout. Use that only in trusted scripts because the token is a live bearer token.

---

## Usage

### Basic Deployment

Deploy all changes to your default Sandbox:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --env SANDBOX
```

### Production Deployment

Deploy to production (requires authentication and permissions).
When `--env PRODUCTION` is used, the CLI forces `RunLocalTests`:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --env PRODUCTION \
    --testLevel RunLocalTests
```

### Selective Deployment (Exclude Components)

Skip specific metadata types from deployment with `--exclude`, or prefer `.forceignore` for path-based filtering:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --exclude Profile,NamedCredential,CustomMetadata
```

### Custom Source Directory

Deploy from a different SFDX source directory:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --source ./my-custom-source
```

### Validate Only

Check for metadata issues without deploying:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --validateOnly
```

### Delta Deployment (Compare Branches)

Deploy only changes between branches:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --baseBranch HEAD~1 \
    --targetBranch main
```

---

## Command Options

### Required Options

| Flag | Description |
|------|-------------|
| `-u, --username <username>` | Salesforce username (required) |
| `-c, --clientId <clientId>` | Connected App Client ID (required) |
| `-k, --privateKey <path>` | Path to private key file (required) |

### Common Options

| Flag | Default | Description |
|------|---------|-------------|
| `-e, --env <environment>` | `SANDBOX` | Target environment (SANDBOX or PRODUCTION) |
| `-s, --source <directory>` | `force-app/main/default` | SFDX source directory path |
| `-x, --exclude <types>` | - | Comma-separated list of metadata types to exclude |
| `-t, --testLevel <level>` | `NoTestRun` | Test level: NoTestRun, RunSpecifiedTests, RunLocalTests, RunAllTestsInOrg |
| `-v, --validateOnly` | `false` | Validate only, do not deploy |

### Deployment Options

| Flag | Default | Description |
|------|---------|-------------|
| `-b, --baseBranch <branch>` | `HEAD~1` | Base branch for delta deployment |
| `-r, --targetBranch <branch>` | `HEAD` | Target branch for delta deployment |
| `quick-deploy -q, --quickDeployId <id>` | - | Use a validated deployment ID with the `quick-deploy` subcommand |
| `auth:token --json` | - | Print token details as JSON |
| `auth:token -o, --output <path>` | - | Write token details to a JSON file with `0600` permissions |

### Display Options

| Flag | Default | Description |
|------|---------|-------------|
| `-h, --help` | - | Display help information |
| `-V, --version` | - | Display version number |

---

## Deployment Modes

### Standard Deployment

Upload and deploy a new package to Salesforce:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --env SANDBOX
```

**Flow:**
1. Authenticates with Salesforce
2. Converts SFDX metadata to MDAPI
3. Packages files into deploy.zip
4. Uploads package via Metadata API
5. Polls deployment status
6. Displays results

### Quick Deploy

Use a previously validated deployment ID for instant deployment (ideal for CI/CD):

```bash
# First, deploy and save the deployment ID
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --env SANDBOX

# Use the returned deployment ID for quick deploy
simpleSfCli quick-deploy \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --quickDeployId "0Af30000000xyz"
```

**Benefits:**
- ~5 second deployment time
- No metadata conversion
- Optimized for CI/CD pipelines

### Delta Deployment

Deploy only changed metadata between two git references:

```bash
simpleSfCli \
    --username user@example.com \
    --clientId client123 \
    --privateKey ./server.key \
    --baseBranch develop \
    --targetBranch feature/my-feature
```

**Git Filters:**
- `D`: Deleted files
- `M`: Modified files
- `A`: Added files
- `AM`: Added and modified files

---

## Configuration

### Default Configuration

```typescript
{
  source: 'force-app/main/default',
  output: 'deploy.zip',
  env: 'SANDBOX',
  baseBranch: 'HEAD~1',
  targetBranch: 'HEAD',
  sfVersion: 'v60.0',
  cliVersion: '0.6.0',
  cliOuputFolder: '.simpleSfCli_out',
  testLevel: 'NoTestRun',
  coverageJson: './ApexTestCoverage.json'
}
```

### Environment Variables Override

The CLI does not currently read configuration directly from environment variables.
Use shell variables and pass them to flags explicitly:

```bash
export SF_ENV="PRODUCTION"
export SF_SOURCE="custom/src"
export SF_TEST_LEVEL="RunLocalTests"

simpleSfCli \
  --username "$SF_USERNAME" \
  --clientId "$SF_CLIENT_ID" \
  --privateKey "$SF_PRIVATE_KEY_PATH" \
  --env "$SF_ENV" \
  --source "$SF_SOURCE" \
  --testLevel "$SF_TEST_LEVEL"
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Salesforce

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Sandbox
        env:
          SF_USERNAME: ${{ secrets.SF_USERNAME }}
          SF_CLIENT_ID: ${{ secrets.SF_CLIENT_ID }}
          SF_PRIVATE_KEY: ${{ secrets.SF_PRIVATE_KEY }}
        run: |
          echo "$SF_PRIVATE_KEY" > server.key
          npx simple-sf-cli \
            --username "$SF_USERNAME" \
            --clientId "$SF_CLIENT_ID" \
            --privateKey ./server.key \
            --env SANDBOX \
            --testLevel RunLocalTests
      
      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        env:
          SF_USERNAME: ${{ secrets.SF_PROD_USERNAME }}
          SF_CLIENT_ID: ${{ secrets.SF_PROD_CLIENT_ID }}
          SF_PRIVATE_KEY: ${{ secrets.SF_PROD_PRIVATE_KEY }}
        run: |
          echo "$SF_PRIVATE_KEY" > server.key
          npx simple-sf-cli \
            --username "$SF_PROD_USERNAME" \
            --clientId "$SF_PROD_CLIENT_ID" \
            --privateKey ./server.key \
            --env PRODUCTION \
            --testLevel RunLocalTests
```

### GitLab CI Example

```yaml
stages:
  - deploy

deploy_sandbox:
  stage: deploy
  script:
    - |
      echo "$SF_PRIVATE_KEY" > server.key
      npx simple-sf-cli \
        --username "$SF_USERNAME" \
        --clientId "$SF_CLIENT_ID" \
        --privateKey ./server.key \
        --env SANDBOX \
        --testLevel RunLocalTests
  only:
    - develop

deploy_production:
  stage: deploy
  script:
    - |
      echo "$SF_PRIVATE_KEY" > server.key
      npx simple-sf-cli \
        --username "$SF_PROD_USERNAME" \
        --clientId "$SF_PROD_CLIENT_ID" \
        --privateKey ./server.key \
        --env PRODUCTION \
        --testLevel RunLocalTests
  when: manual
  only:
    - main
```

### Bitbucket Pipelines Example

```yaml
pipelines:
  default:
    - step:
        name: Deploy to Sandbox
        deployment: sandbox
        script:
          - |
            echo "$SF_PRIVATE_KEY" > server.key
            npx simple-sf-cli \
              --username "$SF_USERNAME" \
              --clientId "$SF_CLIENT_ID" \
              --privateKey ./server.key \
              --env SANDBOX \
              --testLevel RunLocalTests
        caches:
          - node

  branches:
    main:
      - step:
          name: Deploy to Production
          deployment: production
          script:
            - |
              echo "$SF_PRIVATE_KEY" > server.key
              npx simple-sf-cli \
                --username "$SF_PROD_USERNAME" \
                --clientId "$SF_PROD_CLIENT_ID" \
                --privateKey ./server.key \
                --env PRODUCTION \
                --testLevel RunLocalTests
          caches:
            - node
```

### Excluding Components in CI/CD

Prefer `.forceignore` for path-based exclusions:

```text
profiles/**
namedCredentials/**
labels/CustomLabels.labels-meta.xml
```

Use `--exclude` only when you need metadata-type filtering:

```bash
npx simple-sf-cli \
  --username user@example.com \
  --clientId client123 \
  --privateKey ./server.key \
  --env SANDBOX \
  --exclude Profile,NamedCredential,CustomMetadata \
  --testLevel RunLocalTests
```

---

## Development

### Project Structure

```
SimpleSfCLI/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── config.ts              # Configuration
│   ├── SalesforceClient.ts    # Main client orchestration
│   ├── helper/                # Helpers and constants
│   ├── types/                 # TypeScript type definitions
│   └── services/              # Business logic services
│       ├── AuthService.ts     # Authentication
│       ├── MDAPIService.ts    # MDAPI conversion
│       ├── DeployService.ts   # Deployment logic
│       ├── ArchiverService.ts # File packaging
│       └── BaseService.ts     # Base service utilities
├── dist/                      # Distribution files
├── package.json               # Project configuration
├── tsconfig.json              # TypeScript configuration
└── jest.config.ts             # Jest configuration
```

### Development Setup

```bash
# Clone the repository
git clone https://github.com/thephani/SimpleSfCLI.git
cd SimpleSfCLI

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Available Scripts

```json
{
  "scripts": {
    "clean": "rimraf dist",
    "build": "tsc",
    "prebuild": "npm run clean",
    "prepare": "npm run build",
    "test": "jest --collectCoverage --verbose --silent"
  }
}
```

---

## Contributing

We welcome contributions! Please follow these steps:

### Contribution Guidelines

1. **Fork the repository** and create a feature branch
2. **Make your changes** following existing code style
3. **Add tests** for new features
4. **Run tests**: `npm test`
5. **Update documentation** as needed
6. **Submit a pull request**

### Pull Request Template

```markdown
## Description
<!-- Brief description of changes -->

## Pre-submission Checklist
- [ ] I have updated the package version in `package.json`
- [ ] I have run all tests locally (`npm test`)
- [ ] I have added tests for new features (if applicable)
- [ ] Documentation has been updated (if applicable)

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Additional Notes
<!-- Any additional information for reviewers -->
```

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public functions
- Write clear, descriptive commit messages
- Update CHANGELOG when appropriate

---

## Documentation

For complete documentation, visit:

- **API Reference**: [SimpleSfCLI Documentation](https://thephani.github.io/SimpleSfCLI/)
- **Metadata Types**: [Salesforce Metadata API Reference](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/)
- **Authentication Guide**: [Salesforce JWT Auth](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_key_and_cert.htm)

---

## Package Details

| Metric | Value |
|--------|-------|
| Package Size | 19.1 KB |
| Unpacked Size | ~81 KB |
| Dependencies | 4 (minimal footprint) |
| TypeScript | Yes |
| Node.js Version | 16+ |

---

## Troubleshooting

### Common Issues

**1. Authentication Fails**
```
Error: JWT token expired or invalid
```
**Solution:** Verify your private key and ensure the certificate is uploaded to Salesforce.

**2. Deployment Timeout**
```
Error: Deployment timed out
```
**Solution:** Increase timeout or check your internet connection.

**3. Metadata Not Found**
```
Error: No supported metadata found
```
**Solution:** Verify your git diff filters and ensure files are in the correct source directory.

**4. Custom Field Delta Deployment Fails**
```
Must specify a non-empty label for the CustomObject
Not in package.xml
```
**Solution:** Upgrade to `2.7.4` or later and rebuild local `dist` output if running from source. Field-only changes must appear in `.simpleSfCli_out/package.xml` as `CustomField` members, for example `Program__c.Partner_Status__c`, and the member must match the field XML `<fullName>`.

**5. Certificate Issues**
```
Error: Invalid certificate
```
**Solution:** Re-generate private key and certificate, and re-upload to Salesforce.

### Debug Mode

There is no dedicated debug flag today. Use the normal console output and inspect generated artifacts when troubleshooting.

```bash
npx simple-sf-cli --help
```

### Check Logs

Deployment logs are saved to:
- `.simpleSfCli_out/` directory (converted metadata)
- Console output (deployment status and errors)

---

## Security Considerations

- **Never commit private keys** to version control
- Never commit `.simpleSfCli_auth.json` or any exported token file
- Use environment variables or secrets for credentials
- Prefer re-authenticating in cron jobs over sharing token files when possible
- Rotate credentials regularly
- Limit Connected App permissions to only what's needed
- Enable IP restrictions on Connected Apps when possible
- Use sandbox environments for testing before production

## Support

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/thephani/SimpleSfCLI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/thephani/SimpleSfCLI/discussions)
- **User Feedback**: [Share Your Thoughts](https://forms.gle/6K7nzE1Xrh5GVJvG7)

### Community

- Follow [Simple SF CLI](https://github.com/thephani/SimpleSfCLI) for updates
- Join our [GitHub Discussions](https://github.com/thephani/SimpleSfCLI/discussions) for community help

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Phanindra Mangipudi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Acknowledgments

- Built with ❤️ for the Salesforce developer community
- Inspired by the need for faster, simpler deployment workflows
- Built using modern TypeScript and Node.js ecosystem

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for versioned release notes, including the latest `2.7.4` deployment fixes.

---

**Simple SF CLI** - Empowering Salesforce deployments with speed and simplicity.
