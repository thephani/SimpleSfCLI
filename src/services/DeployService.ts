import fs from 'fs';
import { BaseService } from './BaseService.js';
import type { DeployOptions, DeployResult } from '../types/deployment.type.js';

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
      return deployResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Quick deploy failed';
      throw new Error(`Quick deploy error: ${errorMessage}`);
    }
  }

  async initiateDeployment(zipPath: string, options: Partial<DeployOptions> = {}): Promise<string> {
    const soapRequest = await this.createDeployRequest(zipPath, options);

    const response = await fetch(`${this.config.instanceUrl}/services/Soap/m/62.0`, {
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
    const maxAttempts = 120;

    while (attempt < maxAttempts) {
      const status = await this.getDeploymentStatus(deployId);
      // console.table(status.details.componentFailures);
      if (status.numberComponentsDeployed === 0) console.log('Pending Deployment. ');
      
      else console.log(`Deploying Components: ${status.numberComponentsDeployed} / ${status.numberComponentsTotal}`);
      if (status.numberTestsTotal > 0) {
        console.log(`Running Test Status: ${status.numberTestsCompleted} / ${status.numberTestsTotal}`);
      }
      // if (status.numberTestErrors > 0 || status.numberComponentErrors > 0) { // status.details?.componentFailures.length > 0
      if(status.status === 'Failed') {
        console.log('🚨📢🔔 DEPLOYMENT FAILED 🚨📢🔔');
        // Create a new array with only the selected properties
        const failedTests = status.details.runTestResult?.failures.map(({ stackTrace }) => ({ stackTrace }));
        if (failedTests?.length) {
          console.table(failedTests);
        }
        if (status.details?.componentFailures) {
          const failedComponenets = status.details?.componentFailures.map(({ fileName, fullName, problem }) => ({ fileName, fullName, problem }));
          console.table(failedComponenets);
          // console.log('Failed Components:', status.details.componentFailures);
        }
      }

      if (status.done) {
        return status;
      }

      await this.wait(5000 * Math.min(attempt + 1, 6));
      attempt++;
    }

    throw new Error('Deployment timed out');
  }

  private async getDeploymentStatus(deployId: string): Promise<DeployResult> {
    const response = await this.fetchWithAuth(`${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/deployRequest/${deployId}?includeDetails=true`, { method: 'GET' });
    const data = (await response.json()) as { deployResult: DeployResult };
    return data.deployResult;
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
}
