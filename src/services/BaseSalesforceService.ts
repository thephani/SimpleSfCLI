import { DeployAuthConfig } from '../core/types/deploy';

export abstract class BaseSalesforceService {
  protected readonly config: DeployAuthConfig;

  constructor(config: DeployAuthConfig) {
    this.config = config;
  }

  protected async fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    return response;
  }
}
