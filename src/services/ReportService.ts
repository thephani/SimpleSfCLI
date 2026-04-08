import fs from 'fs';
import path from 'path';
import type { ReportFormat, DeploymentReport, DeploymentSummary, DeploymentComponentFailure, DeploymentTestFailure } from '../types/deployment.type.js';

interface ReportWriteOptions {
	reportFormat?: ReportFormat;
	reportPath?: string;
	emitConsoleSummary?: boolean;
}

interface DeploymentReportPayload {
	summary: DeploymentSummary;
	componentFailures: DeploymentComponentFailure[];
	testFailures: DeploymentTestFailure[];
}

export class ReportService {
	async writeDeploymentReport(payload: DeploymentReportPayload, options: ReportWriteOptions = {}): Promise<string[]> {
		const reportFormat = options.reportFormat ?? 'json';
		const reportPath = options.reportPath ?? './reports';
		const generatedAt = new Date().toISOString();
		const report: DeploymentReport = {
			generatedAt,
			summary: payload.summary,
			componentFailures: payload.componentFailures,
			testFailures: payload.testFailures,
		};

		await fs.promises.mkdir(reportPath, { recursive: true });

		const baseFileName = `deployment-${payload.summary.deploymentId}-${generatedAt.replace(/[:.]/g, '-')}`;
		const outputFiles: string[] = [];

		if (reportFormat === 'json' || reportFormat === 'both') {
			const jsonPath = path.join(reportPath, `${baseFileName}.json`);
			await fs.promises.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
			outputFiles.push(jsonPath);
		}

		if (reportFormat === 'junit' || reportFormat === 'both') {
			const junitPath = path.join(reportPath, `${baseFileName}.xml`);
			const junitXml = this.generateJUnitReport(report);
			await fs.promises.writeFile(junitPath, junitXml, 'utf8');
			outputFiles.push(junitPath);
		}

		if (options.emitConsoleSummary) {
			this.printSummary(report.summary, outputFiles);
		}

		return outputFiles;
	}

	generateJUnitReport(report: DeploymentReport): string {
		const testCases = report.testFailures
			.map(
				(failure) =>
					`    <testcase classname="${this.escapeXml(failure.name)}" name="${this.escapeXml(failure.methodName)}">\n` +
					`      <failure message="${this.escapeXml(failure.message)}">${this.escapeXml(failure.stackTrace)}</failure>\n` +
					'    </testcase>'
			)
			.join('\n');

		const componentCases = report.componentFailures
			.map(
				(failure) =>
					`    <testcase classname="${this.escapeXml(failure.componentType)}" name="${this.escapeXml(failure.fullName)}">\n` +
					`      <failure message="${this.escapeXml(failure.problemType)}">${this.escapeXml(failure.problem)}</failure>\n` +
					'    </testcase>'
			)
			.join('\n');

		const failureCases = [testCases, componentCases].filter(Boolean).join('\n');
		const totalFailures = report.testFailures.length + report.componentFailures.length;
		const totalTests = Math.max(report.summary.tests.total, totalFailures, 1);

		return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="Salesforce Deployment ${this.escapeXml(report.summary.deploymentId)}" tests="${totalTests}" failures="${totalFailures}">\n${failureCases}\n</testsuite>\n`;
	}

	private printSummary(summary: DeploymentSummary, outputFiles: string[]): void {
		console.log(`🧾 Deployment report (${summary.status}) generated:`);
		for (const reportFile of outputFiles) {
			console.log(` - ${reportFile}`);
		}
	}

	private escapeXml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}
}
