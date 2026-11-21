import fs from 'fs';
import defaultConfig from '../config.js';
import { BaseService } from './BaseService.js';
import { DeploymentFailedError } from '../errors/DeploymentFailedError.js';
import type { DeployOptions, DeployResult, DeploymentComponentFailure, DeploymentSummary, DeploymentTestFailure } from '../types/deployment.type.js';

const DEPLOY_ID_PATTERN = /^0Af[A-Za-z0-9]{12,15}$/;

export interface NormalizedDeployResponse {
  id: string;
  done: boolean;
  status: DeployResult['status'];
  success: boolean;
  canceled: boolean;
  errorCount: number;
  testErrorCount: number;
  componentErrorCount: number;
  summary: string;
}

export class DeployService extends BaseService {
  async quickDeploy(deploymentId: string): Promise<DeployResult> {
    try {
      console.log(`Initiating quick deploy for Deployment ID: ${deploymentId}`);

      const response = await this.fetchWithAuth(`${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/deployRequest/validatedDeployRequestId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validatedDeployRequestId: deploymentId }),
      });

      const deployResult = (await response.json()) as DeployResult;
      if (deployResult?.done && deployResult.status === 'Succeeded') {
        return deployResult;
      }

      const targetDeployId = deployResult?.id || deploymentId;
      return await this.pollDeploymentStatus(targetDeployId);
    } catch (error) {
      if (error instanceof DeploymentFailedError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Quick deploy failed';
      throw new Error(`Quick deploy error: ${errorMessage}`);
    }
  }

  async initiateDeployment(zipPath: string, options: Partial<DeployOptions> = {}): Promise<string> {
    const soapRequest = await this.createDeployRequest(zipPath, options);
    const soapVersion = (this.config.sfVersion || defaultConfig.sfVersion).replace(/^v/i, '');

    const response = await fetch(`${this.config.instanceUrl}/services/Soap/m/${soapVersion}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        SOAPAction: 'deploy',
      },
      body: soapRequest,
    });

    if (!response.ok) {
      console.error('Deployment failed:', response.status, await response.text());
      throw new Error(`Deployment failed: ${response.status}`);
    }

    const data = await response.text();
    const deployId = data.match(/<id>(.*?)<\/id>/)?.[1];

    if (!deployId) {
      throw new Error('Failed to extract deployment ID');
    }

    return deployId;
  }

  async pollDeploymentStatus(deployId: string): Promise<DeployResult> {
    let attempt = 0;
    const maxAttempts = this.config.maxPollAttempts ?? 120;
    const pollInterval = this.config.pollInterval ?? 5000;

    while (attempt < maxAttempts) {
      const status = await this.getDeploymentStatus(deployId);
      // console.table(status.details.componentFailures);
      if (status.numberComponentsDeployed === 0) console.log('Pending Deployment. ');
      
      else console.log(`Deploying Components: ${status.numberComponentsDeployed} / ${status.numberComponentsTotal}`);
      if (status.numberTestsTotal > 0) {
        console.log(`Running Test Status: ${status.numberTestsCompleted} / ${status.numberTestsTotal}`);
      }
      // if (status.numberTestErrors > 0 || status.numberComponentErrors > 0) { // status.details?.componentFailures.length > 0
      if (status.status === 'Failed' || status.status === 'SucceededPartial') {
        console.log('🚨📢🔔 DEPLOYMENT FAILED 🚨📢🔔');
        const failedTests = this.serializeTestFailures(status).map(({ name, methodName, message, stackTrace }) => ({
          name,
          methodName,
          message,
          stackTrace,
        }));
        if (failedTests.length) {
          console.table(failedTests);
        }
        const failedComponents = this.serializeComponentFailures(status).map(({ fileName, fullName, problem }) => ({
          fileName,
          fullName,
          problem,
        }));
        if (failedComponents.length) {
          console.table(failedComponents);
        }
      }

      if (status.done) {
        if (status.status !== 'Succeeded') {
          throw new DeploymentFailedError(deployId, status);
        }
        return status;
      }

      await this.wait(pollInterval * Math.min(attempt + 1, 6));
      attempt++;
    }

    throw new Error('Deployment timed out');
  }

  async fetchDeploymentStatus(deployId: string): Promise<DeployResult> {
    this.validateDeployId(deployId);
    return this.getDeploymentStatus(deployId);
  }

  private async getDeploymentStatus(deployId: string): Promise<DeployResult> {
    const response = await this.fetchWithAuth(`${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/deployRequest/${deployId}?includeDetails=true`, { method: 'GET' });
    const data = (await response.json()) as { deployResult: DeployResult };
    return data.deployResult;
  }

  async cancelDeployment(deployId: string): Promise<DeployResult> {
    this.validateDeployId(deployId);
    const response = await this.fetchWithAuth(`${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/deployRequest/${deployId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelDeploy: true }),
    });
    const data = (await response.json()) as { deployResult?: DeployResult };

    if (data.deployResult) {
      return data.deployResult;
    }

    return this.fetchDeploymentStatus(deployId);
  }

  formatDeployResponse(result: DeployResult): NormalizedDeployResponse {
    const componentErrorCount = result.numberComponentErrors ?? 0;
    const testErrorCount = result.numberTestErrors ?? 0;
    const errorCount = componentErrorCount + testErrorCount;
    const canceled = result.status === 'Canceled';
    // SucceededPartial is treated as a failure, consistent with pollDeploymentStatus and the CLI exit code.
    const success = result.status === 'Succeeded';
    const summary = `${result.status} | components ${result.numberComponentsDeployed ?? 0}/${result.numberComponentsTotal ?? 0} | tests ${result.numberTestsCompleted ?? 0}/${result.numberTestsTotal ?? 0} | errors ${errorCount}`;

    return {
      id: result.id,
      done: result.done,
      status: result.status,
      success,
      canceled,
      errorCount,
      testErrorCount,
      componentErrorCount,
      summary,
    };
  }

  serializeSummary(status: DeployResult): DeploymentSummary {
    return {
      deploymentId: status.id,
      status: status.status,
      done: status.done,
      components: {
        deployed: status.numberComponentsDeployed ?? 0,
        total: status.numberComponentsTotal ?? 0,
        errors: status.numberComponentErrors ?? 0,
      },
      tests: {
        completed: status.numberTestsCompleted ?? 0,
        total: status.numberTestsTotal ?? 0,
        errors: status.numberTestErrors ?? 0,
      },
      stateDetail: status.stateDetail,
    };
  }

  serializeComponentFailures(status: DeployResult): DeploymentComponentFailure[] {
    return this.toArray(status.details?.componentFailures);
  }

  serializeTestFailures(status: DeployResult): DeploymentTestFailure[] {
    return this.toArray(status.details?.runTestResult?.failures);
  }

  /** Salesforce returns a single object instead of an array when there is exactly one entry. */
  private toArray<T>(value: T[] | T | undefined | null): T[] {
    if (value === undefined || value === null) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  private async createDeployRequest(zipPath: string, options: Partial<DeployOptions>): Promise<string> {
    const zipContent = fs.readFileSync(zipPath);
    const base64Zip = zipContent.toString('base64');

    return `<?xml version="1.0" encoding="UTF-8"?>
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                             xmlns:met="http://soap.sforce.com/2006/04/metadata">
                <soapenv:Header>
                    <met:SessionHeader>
                        <met:sessionId>${this.config.accessToken}</met:sessionId>
                    </met:SessionHeader>
                </soapenv:Header>
                <soapenv:Body>
                    <met:deploy>
                        <met:ZipFile>${base64Zip}</met:ZipFile>
                        <met:DeployOptions>
                            <met:allowMissingFiles>false</met:allowMissingFiles>
                            <met:checkOnly>${options.checkOnly ?? false}</met:checkOnly>
                            <met:testLevel>${options.testLevel ?? 'NoTestRun'}</met:testLevel>
                            ${this.generateRunTestsXml(options)}
                            <met:rollbackOnError>true</met:rollbackOnError>
                            <met:singlePackage>true</met:singlePackage>
                        </met:DeployOptions>
                    </met:deploy>
                </soapenv:Body>
            </soapenv:Envelope>`;
  }

  private generateRunTestsXml(options: Partial<DeployOptions>): string {
    if (options.testLevel === 'RunSpecifiedTests' && options.runTests?.length) {
      return options.runTests.map((test) => `<met:runTests>${test}</met:runTests>`).join('');
    }
    return '';
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private validateDeployId(deployId: string): void {
    if (!DEPLOY_ID_PATTERN.test(deployId)) {
      throw new Error(`Invalid deploy ID: ${deployId}`);
    }
  }
}
