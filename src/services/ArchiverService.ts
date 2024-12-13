// / src/services/ArchiverService.ts
import fs from 'fs';
import { BaseService } from './BaseService.js';
import archiver from 'archiver';

export class ArchiverService extends BaseService {
	async zipDirectory(sourceDir: string, outputFilePath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const output = fs.createWriteStream(outputFilePath);
			const archive = archiver('zip', { zlib: { level: 9 } });

			archive.on('error', reject);
			output.on('close', resolve);

			archive.pipe(output);
			archive.directory(sourceDir, false);
			archive.finalize();
		});
	}
}
