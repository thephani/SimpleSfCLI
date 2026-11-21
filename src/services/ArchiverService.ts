import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { BaseService } from './BaseService.js';
import archiver from 'archiver';

const execFileAsync = promisify(execFile);

export class ArchiverService extends BaseService {
    async zipDirectory(sourceDir: string, outputFilePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('error', (err) => {
                output.destroy();
                reject(err);
            });

            output.on('error', (err) => {
                archive.abort();
                reject(err);
            });

            output.on('close', resolve);

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    }

    async extractZipFile(zipFilePath: string, outputDir: string): Promise<void> {
        await fs.promises.mkdir(outputDir, { recursive: true });
        await execFileAsync('unzip', ['-o', zipFilePath, '-d', outputDir]);
    }

    async extractBase64Zip(base64Zip: string, outputDir: string): Promise<void> {
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'simplesfcli-retrieve-'));
        const zipFilePath = path.join(tmpDir, 'retrieve.zip');

        try {
            await fs.promises.writeFile(zipFilePath, Buffer.from(base64Zip, 'base64'));
            await this.extractZipFile(zipFilePath, outputDir);
        } finally {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
    }
}
