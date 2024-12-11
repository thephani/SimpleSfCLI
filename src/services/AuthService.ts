import fs from 'fs';
import jwt from 'jsonwebtoken';
import { BaseService } from './BaseService.js';

export class AuthService extends BaseService {
	async authenticate(): Promise<void> {
		try {
			const privateKeyContents = fs.readFileSync(this.config.privateKey!, 'utf-8');
			const jwtToken = this.createJwtToken(privateKeyContents);
			await this.getAccessToken(jwtToken);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
			throw new Error(`Authentication error: ${errorMessage}`);
		}
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

	private async getAccessToken(jwtToken: string): Promise<void> {
		const response = await fetch(`${this.config.instanceUrl}/services/oauth2/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`,
		});

		if (!response.ok) {
			throw new Error(`Authentication failed: ${response.status}`);
		}

		const { access_token, instance_url } = (await response.json()) as { access_token: string; instance_url: string };
		this.config.accessToken = access_token;
		this.config.instanceUrl = instance_url;
	}
}
