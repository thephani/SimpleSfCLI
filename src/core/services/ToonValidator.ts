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
    const issues: ValidationIssue[] = [];

    let index;
    try {
      index = await repository.loadIndex();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown index parse error';
      return {
        valid: false,
        scannedFiles: 0,
        issues: [{ file: '_index/components.json', message }],
      };
    }

    for (const component of index.components) {
      if (!component.id || !component.metadataType || !component.fullName || !component.toonFilePath) {
        issues.push({ file: component.toonFilePath || '_index/components.json', message: 'Index entry missing required fields' });
        continue;
      }

      if (!SUPPORTED_METADATA_TYPES.has(component.metadataType)) {
        issues.push({ file: component.toonFilePath, message: `Unsupported metadataType: ${component.metadataType}` });
      }

      try {
        await repository.loadToonPayloadFromFs(component.toonFilePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown TOON parse error';
        issues.push({ file: component.toonFilePath, message });
      }
    }

    return {
      valid: issues.length === 0,
      scannedFiles: index.componentCount,
      issues,
    };
  }
}
