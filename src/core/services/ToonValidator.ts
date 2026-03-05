import { SUPPORTED_METADATA_TYPES } from '../../constants/metadata';
import { ToonRepository } from './ToonRepository';

export interface ValidationIssue {
  file: string;
  message: string;
}

export interface ValidationSummary {
  valid: boolean;
  scannedFiles: number;
  issues: ValidationIssue[];
}

export class ToonValidator {
  async run(toonRoot: string): Promise<ValidationSummary> {
    const repository = new ToonRepository(toonRoot);
    const toonFiles = await repository.listToonFiles();
    const issues: ValidationIssue[] = [];

    for (const toonFile of toonFiles) {
      try {
        const summary = await repository.loadComponentSummaryFromFs(toonFile);

        if (!summary.id || !summary.metadataType || !summary.fullName || !summary.toonFilePath) {
          issues.push({ file: toonFile, message: 'Invalid component summary derived from TOON file' });
          continue;
        }

        if (!SUPPORTED_METADATA_TYPES.has(summary.metadataType)) {
          issues.push({ file: toonFile, message: `Unsupported metadataType: ${summary.metadataType}` });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown TOON parse error';
        issues.push({ file: toonFile, message });
      }
    }

    return {
      valid: issues.length === 0,
      scannedFiles: toonFiles.length,
      issues,
    };
  }
}
