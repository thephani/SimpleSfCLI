import fs from 'fs';
import jwt from 'jsonwebtoken';
import { DeployAuthConfig } from '../core/types/deploy';
import { BaseSalesforceService } from './BaseSalesforceService';

export class AuthService extends BaseSalesforceService {
  constructor(config: DeployAuthConfig) {
    super(config);
  }

  async authenticate(): Promise<void> {
    const privateKey = await fs.promises.readFile(this.config.privateKey, 'utf8');
    const token = this.createJwtToken(privateKey);

    const response = await fetch(`${this.config.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
    });

    if (!response.ok) {
      throw new Error(`Authentication failed (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as { access_token: string; instance_url: string };
    this.config.accessToken = data.access_token;
    this.config.instanceUrl = data.instance_url;
  }

  private createJwtToken(privateKey: string): string {
    return jwt.sign(
      {
        iss: this.config.clientId,
        sub: this.config.username,
        aud: this.config.instanceUrl,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      privateKey,
      { algorithm: 'RS256' }
    );
  }
}
