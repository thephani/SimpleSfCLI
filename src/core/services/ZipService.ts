import fs from 'fs';
import archiver from 'archiver';

export class ZipService {
  async zipDirectory(sourceDir: string, outputFilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', (error) => reject(error));
      archive.on('error', (error) => reject(error));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
}
