import fs from 'fs';
import { BaseSalesforceService } from './BaseSalesforceService';
import { DeployAuthConfig, DeployOptions, DeployResult } from '../core/types/deploy';

export class MetadataDeployService extends BaseSalesforceService {
  constructor(config: DeployAuthConfig) {
    super(config);
  }

  async quickDeploy(validatedDeployRequestId: string): Promise<DeployResult> {
    const response = await this.fetchWithAuth(
      `${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/deployRequest/validatedDeployRequestId`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validatedDeployRequestId }),
      }
    );

    return (await response.json()) as DeployResult;
  }

  async deployZip(zipPath: string, options: Partial<DeployOptions>): Promise<DeployResult> {
    const deployId = await this.initiateDeployment(zipPath, options);
    return this.pollDeploymentStatus(deployId);
  }

  private async initiateDeployment(zipPath: string, options: Partial<DeployOptions>): Promise<string> {
    const zipContent = await fs.promises.readFile(zipPath);
    const base64Zip = zipContent.toString('base64');

    const soapRequest = this.createDeployRequest(base64Zip, options);
    const response = await fetch(`${this.config.instanceUrl}/services/Soap/m/${this.config.sfVersion.replace(/^v/i, '')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        SOAPAction: 'deploy',
      },
      body: soapRequest,
    });

    if (!response.ok) {
      throw new Error(`Deployment initiation failed (${response.status}): ${await response.text()}`);
    }

    const xml = await response.text();
    const match = xml.match(/<id>([^<]+)<\/id>/);

    if (!match?.[1]) {
      throw new Error('Unable to extract deployment ID from SOAP response');
    }

    return match[1];
  }

  private async pollDeploymentStatus(deployId: string): Promise<DeployResult> {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.fetchWithAuth(
        `${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/deployRequest/${deployId}?includeDetails=true`,
        { method: 'GET' }
      );

      const payload = (await response.json()) as { deployResult: DeployResult };
      const result = payload.deployResult;

      if (result.done) {
        return result;
      }

      await wait(5000 * Math.min(attempt + 1, 6));
    }

    throw new Error('Deployment timed out while polling status');
  }

  private createDeployRequest(base64Zip: string, options: Partial<DeployOptions>): string {
    const runTests = options.testLevel === 'RunSpecifiedTests' && options.runTests?.length
      ? options.runTests.map((test) => `<met:runTests>${test}</met:runTests>`).join('')
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Header>
    <met:SessionHeader>
      <met:sessionId>${this.config.accessToken}</met:sessionId>
    </met:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <met:deploy>
      <met:ZipFile>${base64Zip}</met:ZipFile>
      <met:DeployOptions>
        <met:allowMissingFiles>${options.allowMissingFiles ?? false}</met:allowMissingFiles>
        <met:checkOnly>${options.checkOnly ?? false}</met:checkOnly>
        <met:testLevel>${options.testLevel ?? 'NoTestRun'}</met:testLevel>
        ${runTests}
        <met:rollbackOnError>${options.rollbackOnError ?? true}</met:rollbackOnError>
        <met:singlePackage>${options.singlePackage ?? true}</met:singlePackage>
      </met:DeployOptions>
    </met:deploy>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
