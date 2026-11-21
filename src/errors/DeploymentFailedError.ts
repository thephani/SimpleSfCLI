import type { DeployResult } from '../types/deployment.type.js';

/**
 * Thrown when a deployment reaches a terminal state other than `Succeeded`.
 * Carries the final deploy result so callers can still report on it.
 */
export class DeploymentFailedError extends Error {
	readonly result: DeployResult;

	constructor(deployId: string, result: DeployResult) {
		super(`Deployment ${deployId} ended with status ${result.status}`);
		this.name = 'DeploymentFailedError';
		this.result = result;
	}
}
