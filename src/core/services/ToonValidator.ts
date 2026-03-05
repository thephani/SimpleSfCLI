import { SUPPORTED_METADATA_TYPES } from '../../constants/metadata';
import { ToonRepository } from './ToonRepository';
import { ToonComponent } from '../types/toon';
import { sha256 } from '../utils/hash';
import { stableStringify } from '../utils/stableStringify';

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
        const component = await repository.loadComponentFromFs(toonFile);
        this.validateComponent(toonFile, component, issues);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown parse error';
        issues.push({ file: toonFile, message });
      }
    }

    return {
      valid: issues.length === 0,
      scannedFiles: toonFiles.length,
      issues,
    };
  }

  private validateComponent(file: string, component: ToonComponent, issues: ValidationIssue[]): void {
    if (component.toonVersion !== '1.0') {
      issues.push({ file, message: `Unsupported toonVersion: ${component.toonVersion}` });
    }

    if (!component.id || !component.metadataType || !component.fullName || !component.hash) {
      issues.push({ file, message: 'Missing required top-level fields (id, metadataType, fullName, hash)' });
    }

    if (!SUPPORTED_METADATA_TYPES.has(component.metadataType)) {
      issues.push({ file, message: `Unsupported metadataType: ${component.metadataType}` });
    }

    const recalculated = sha256(stableStringify({
      toonVersion: component.toonVersion,
      id: component.id,
      metadataType: component.metadataType,
      fullName: component.fullName,
      apiVersion: component.apiVersion,
      kind: component.kind,
      parentId: component.parentId,
      spec: component.spec,
      assets: component.assets,
    }));

    if (recalculated !== component.hash) {
      issues.push({ file, message: 'Hash mismatch: component hash does not match content' });
    }
  }
}
