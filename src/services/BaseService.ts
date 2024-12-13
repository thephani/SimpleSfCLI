import { CommandArgsConfig } from "types/config";


export abstract class BaseService {
  protected config: CommandArgsConfig;

  constructor(config: CommandArgsConfig) {
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }
}