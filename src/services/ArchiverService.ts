import fs from 'fs';
import { BaseService } from './BaseService.js';
import archiver from 'archiver';

export class ArchiverService extends BaseService {
    async zipDirectory(sourceDir: string, outputFilePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            // Handle errors from both archive and output stream
            archive.on('error', (err) => {
                output.destroy(); // Clean up the write stream
                reject(err);
            });

            output.on('error', (err) => {
                archive.abort(); // Abort the archiving process
                reject(err);
            });

            output.on('close', resolve);

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    }
}
