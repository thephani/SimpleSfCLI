import fs from 'fs';
import { createSign } from 'crypto';
import { BaseService } from './BaseService.js';

export interface AuthResult {
	accessToken: string;
	instanceUrl: string;
	issuedAt: string;
}

interface SalesforceAuthError {
	error?: string;
	error_description?: string;
}

export class AuthService extends BaseService {
	async authenticate(): Promise<AuthResult> {
		try {
			const privateKeyContents = fs.readFileSync(this.config.privateKey!, 'utf-8');
			const jwtToken = this.createJwtToken(privateKeyContents);
			return await this.getAccessToken(jwtToken);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
			throw new Error(`Authentication error: ${errorMessage}`);
		}
	}

	private createJwtToken(privateKey: string): string {
		const header = this.base64UrlEncode({
			alg: 'RS256',
			typ: 'JWT',
		});
		const payload = this.base64UrlEncode({
			iss: this.config.clientId,
			sub: this.config.username,
			aud: this.config.instanceUrl,
			exp: Math.floor(Date.now() / 1000) + 60,
		});
		const token = `${header}.${payload}`;
		const signature = createSign('RSA-SHA256').update(token).sign(privateKey, 'base64url');

		return `${token}.${signature}`;
	}

	private base64UrlEncode(value: object): string {
		return Buffer.from(JSON.stringify(value)).toString('base64url');
	}

	private async getAccessToken(jwtToken: string): Promise<AuthResult> {
		const tokenUrl = `${this.config.instanceUrl}/services/oauth2/token`;
		const body = new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwtToken,
		});

		const response = await fetch(tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		});

		if (!response.ok) {
			throw new Error(await this.formatAuthFailure(response, tokenUrl));
		}

		const responseData = await response.json();

		const { access_token, instance_url } = (responseData) as { access_token: string; instance_url: string };
		this.config.accessToken = access_token;
		this.config.instanceUrl = instance_url;

		return {
			accessToken: access_token,
			instanceUrl: instance_url,
			issuedAt: new Date().toISOString(),
		};
	}

	private async formatAuthFailure(response: Response, tokenUrl: string): Promise<string> {
		const status = response.statusText ? `${response.status} ${response.statusText}` : `${response.status}`;
		const responseText = await response.text().catch(() => '');
		const detail = this.parseAuthError(responseText);

		return [
			`Authentication failed: ${status}`,
			`tokenUrl=${tokenUrl}`,
			detail,
		].filter(Boolean).join(' ');
	}

	private parseAuthError(responseText: string): string {
		if (!responseText) {
			return '';
		}

		try {
			const authError = JSON.parse(responseText) as SalesforceAuthError;
			const error = authError.error ? `error=${authError.error}` : '';
			const description = authError.error_description ? `description=${authError.error_description}` : '';
			return [error, description].filter(Boolean).join(' ');
		} catch {
			return `response=${responseText}`;
		}
	}
}
