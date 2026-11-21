import fs from 'fs';
import { BaseService } from './BaseService.js';
import type { RetrieveCommandOptions, RetrieveRequestPayload, RetrieveStatusResult, RetrieveUnpackaged } from '../types/retrieve.type.js';

export class RetrieveService extends BaseService {
  async initiateRetrieve(options: RetrieveCommandOptions): Promise<string> {
    const payload = this.buildRetrievePayload(options);

    const response = await this.fetchWithAuth(
      `${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/retrieveRequest`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = (await response.json()) as { id?: string };
    if (!result.id) {
      throw new Error('Failed to initiate retrieve request');
    }

    return result.id;
  }

  async pollRetrieveStatus(retrieveId: string): Promise<RetrieveStatusResult> {
    let attempt = 0;
    const maxAttempts = 120;

    while (attempt < maxAttempts) {
      const status = await this.getRetrieveStatus(retrieveId);
      if (status.done) {
        return status;
      }

      await this.wait(5000 * Math.min(attempt + 1, 6));
      attempt++;
    }

    throw new Error('Retrieve timed out');
  }

  private async getRetrieveStatus(retrieveId: string): Promise<RetrieveStatusResult> {
    const response = await this.fetchWithAuth(
      `${this.config.instanceUrl}/services/data/${this.config.sfVersion}/metadata/retrieveRequest/${retrieveId}`,
      { method: 'GET' }
    );

    return (await response.json()) as RetrieveStatusResult;
  }

  private buildRetrievePayload(options: RetrieveCommandOptions): RetrieveRequestPayload {
    const payload: RetrieveRequestPayload = {
      apiVersion: this.config.sfVersion.replace(/^v/i, ''),
      singlePackage: true,
    };

    if (options.manifestPath) {
      payload.unpackaged = fs.readFileSync(options.manifestPath, 'utf-8');
    } else if (options.metadataFilter) {
      payload.unpackaged = this.parseMetadataFilter(options.metadataFilter);
    }

    return payload;
  }

  private parseMetadataFilter(filter: string): RetrieveUnpackaged {
    const types = filter
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, membersRaw] = entry.split(':').map((part) => part.trim());
        if (!name || !membersRaw) {
          throw new Error(`Invalid metadata filter entry: ${entry}`);
        }

        const members = membersRaw.split(',').map((member) => member.trim()).filter(Boolean);
        if (!members.length) {
          throw new Error(`Invalid metadata members for type: ${name}`);
        }

        return { name, members };
      });

    if (!types.length) {
      throw new Error('Metadata filter is empty');
    }

    return {
      types,
      version: this.config.sfVersion.replace(/^v/i, ''),
    };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
