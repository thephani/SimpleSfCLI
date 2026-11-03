import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');

describe('Category 5: GitHub Action, Benchmarks, Pages Workflow & Launch Kit (F22-F25)', () => {
	describe('F22: Official GitHub Action (action.yml)', () => {
		const actionPath = path.join(REPO_ROOT, 'action.yml');
		const actionContent = fs.readFileSync(actionPath, 'utf-8');

		it('defines composite action with required branding and all 13 inputs', () => {
			expect(actionContent).toContain("using: 'composite'");
			expect(actionContent).toContain("icon: 'zap'");
			expect(actionContent).toContain("color: 'purple'");

			const requiredInputs = [
				'command:',
				'username:',
				'client-id:',
				'private-key:',
				'env:',
				'source:',
				'base-branch:',
				'target-branch:',
				'validate-only:',
				'test-level:',
				'exclude:',
				'quick-deploy-id:',
				'version:',
			];
			for (const input of requiredInputs) {
				expect(actionContent).toContain(`  ${input}`);
			}
		});

		it('handles raw PEM private-key with 0600 permissions, invokes npx simple-sf-cli, and cleans up in always() step', () => {
			expect(actionContent).toContain('-----BEGIN');
			expect(actionContent).toContain('chmod 0600');
			expect(actionContent).toContain('simple-sf-cli@');
			expect(actionContent).toContain('if: always()');

			const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simple-sf-action-test-'));
			try {
				const githubEnvFile = path.join(tempDir, 'github_env');
				fs.writeFileSync(githubEnvFile, '', 'utf-8');

				const capturedArgsFile = path.join(tempDir, 'npx_args.json');
				const capturedKeyPermsFile = path.join(tempDir, 'key_perms.txt');
				const mockBinDir = path.join(tempDir, 'bin');
				fs.mkdirSync(mockBinDir);

				const mockNpxPath = path.join(mockBinDir, 'npx');
				fs.writeFileSync(
					mockNpxPath,
					`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(capturedArgsFile)}, JSON.stringify(args), 'utf-8');
const keyIdx = args.indexOf('--privateKey');
if (keyIdx !== -1 && args[keyIdx + 1]) {
  const stat = fs.statSync(args[keyIdx + 1]);
  fs.writeFileSync(${JSON.stringify(capturedKeyPermsFile)}, (stat.mode & 0o777).toString(8), 'utf-8');
}
`,
					{ mode: 0o755 },
				);

				const runMatch = actionContent.match(/id:\s*run-cli[\s\S]*?run:\s*\|\n([\s\S]*?)\n\s*-\s*name:\s*Clean up/);
				expect(runMatch).not.toBeNull();
				const runScript = runMatch![1];

				execFileSync('bash', ['-c', runScript], {
					env: {
						...process.env,
						PATH: `${mockBinDir}:${process.env.PATH}`,
						RUNNER_TEMP: tempDir,
						GITHUB_ENV: githubEnvFile,
						GITHUB_RUN_ID: '12345',
						INPUT_COMMAND: 'deploy',
						INPUT_USERNAME: 'user@example.com',
						INPUT_CLIENT_ID: 'client123',
						INPUT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----',
						INPUT_ENV: 'SANDBOX',
						INPUT_SOURCE: 'force-app/main/default',
						INPUT_BASE_BRANCH: 'origin/main',
						INPUT_TARGET_BRANCH: 'HEAD',
						INPUT_VALIDATE_ONLY: 'true',
						INPUT_TEST_LEVEL: 'RunLocalTests',
						INPUT_EXCLUDE: 'Profile CustomMetadata',
						INPUT_QUICK_DEPLOY_ID: '',
						INPUT_VERSION: '2.7.8',
					},
				});

				const capturedArgs = JSON.parse(fs.readFileSync(capturedArgsFile, 'utf-8')) as string[];
				expect(capturedArgs[0]).toBe('--yes');
				expect(capturedArgs[1]).toBe('simple-sf-cli@2.7.8');
				expect(capturedArgs).toContain('deploy');
				expect(capturedArgs).toContain('--validateOnly');
				expect(capturedArgs).toContain('RunLocalTests');
				expect(capturedArgs).toContain('Profile,CustomMetadata');

				const perms = fs.readFileSync(capturedKeyPermsFile, 'utf-8').trim();
				expect(perms).toBe('600');

				const envEntries = fs.readFileSync(githubEnvFile, 'utf-8').trim().split('=');
				expect(envEntries[0]).toBe('SIMPLE_SF_CLI_TEMP_KEY');
				const tempKeyPath = envEntries[1];
				expect(fs.existsSync(tempKeyPath)).toBe(true);

				const cleanupMatch = actionContent.match(/name:\s*Clean up temporary private key[\s\S]*?run:\s*\|\n([\s\S]*)$/);
				expect(cleanupMatch).not.toBeNull();
				execFileSync('bash', ['-c', cleanupMatch![1]], {
					env: {
						...process.env,
						SIMPLE_SF_CLI_TEMP_KEY: tempKeyPath,
					},
				});
				expect(fs.existsSync(tempKeyPath)).toBe(false);
			} finally {
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
		});
	});

	describe('F23: Benchmark Comparison & CI Recipes in README.md', () => {
		const readmeContent = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf-8');

		it('includes the Why Simple SF CLI? benchmark comparison table and CI recipes', () => {
			expect(readmeContent).toContain('## Why Simple SF CLI? (Benchmarks vs. Official Salesforce CLI)');
			expect(readmeContent).toContain('~19 KB');
			expect(readmeContent).toContain('~200+ MB');
			expect(readmeContent).toContain('~5-7s');
			expect(readmeContent).toContain('~60-120s');
			expect(readmeContent).toContain('Requires sfdx-git-delta plugin');
			expect(readmeContent).toContain('Automatic single-zip');
			expect(readmeContent).toContain('Manual multi-step');
			expect(readmeContent).toContain('uses: thephani/SimpleSfCLI@v2');
			expect(readmeContent).toContain('### GitLab CI Example');
			expect(readmeContent).toContain('### Bitbucket Pipelines Example');
		});
	});

	describe('F24: GitHub Pages Workflow (.github/workflows/pages.yml)', () => {
		const pagesWorkflowPath = path.join(REPO_ROOT, '.github/workflows/pages.yml');

		it('configures automated GitHub Pages deployment for index.html on main and workflow_dispatch', () => {
			expect(fs.existsSync(pagesWorkflowPath)).toBe(true);
			const pagesWorkflow = fs.readFileSync(pagesWorkflowPath, 'utf-8');
			expect(pagesWorkflow).toContain('branches: [ main ]');
			expect(pagesWorkflow).toContain('workflow_dispatch:');
			expect(pagesWorkflow).toContain('cp index.html _site/index.html');
			expect(pagesWorkflow).toContain('actions/upload-pages-artifact');
			expect(pagesWorkflow).toContain('actions/deploy-pages');
		});
	});

	describe('F25: Community Launch & Promotion Kit', () => {
		const launchKitPath = path.join(REPO_ROOT, 'docs/promotion/launch-kit.md');
		const demoTapePath = path.join(REPO_ROOT, 'docs/promotion/demo.tape');

		it('provides all 5 promotion templates and the VHS demo.tape script', () => {
			expect(fs.existsSync(launchKitPath)).toBe(true);
			expect(fs.existsSync(demoTapePath)).toBe(true);

			const launchKit = fs.readFileSync(launchKitPath, 'utf-8');
			expect(launchKit).toContain('GitHub Repository Topics & Social Preview Checklist');
			expect(launchKit).toContain('r/salesforce');
			expect(launchKit).toContain('r/SalesforceDeveloper');
			expect(launchKit).toContain('How to Cut Salesforce GitHub Actions PR Validation Time by 80%');
			expect(launchKit).toContain('SFXD Discord');
			expect(launchKit).toContain('Trailblazer Community');
			expect(launchKit).toContain('docs/promotion/demo.tape');

			const demoTape = fs.readFileSync(demoTapePath, 'utf-8');
			expect(demoTape).toContain('Output docs/promotion/simple-sf-cli-benchmark.gif');
			expect(demoTape).toContain('npx simple-sf-cli');
		});
	});
});
