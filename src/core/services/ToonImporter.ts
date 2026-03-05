import fs from 'fs';
import path from 'path';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { ToonAsset, ToonComponent, ToonComponentDraft } from '../types/toon';
import { copyFileWithDirs, ensureDir, listFilesRecursive } from '../utils/fs';
import { sha256 } from '../utils/hash';
import { stableStringify } from '../utils/stableStringify';
import { writeToonFile } from '../utils/toonCodec';

export interface ImportOptions {
  sourceRoot: string;
  toonRoot: string;
  clean: boolean;
}

export interface ImportResultSummary {
  importedCount: number;
  skippedCount: number;
}

export class ToonImporter {
  private readonly registry: AdapterRegistry;

  constructor(registry?: AdapterRegistry) {
    this.registry = registry || new AdapterRegistry();
  }

  async run(options: ImportOptions): Promise<ImportResultSummary> {
    if (!fs.existsSync(options.sourceRoot)) {
      throw new Error(`Source directory does not exist: ${options.sourceRoot}`);
    }

    // Import is always merge/overwrite-only; never delete existing TOON files.
    await ensureDir(options.toonRoot);

    const files = await listFilesRecursive(options.sourceRoot);
    const relativeFiles = files
      .map((file) => path.relative(options.sourceRoot, file).replace(/\\/g, '/'))
      .sort((a, b) => a.localeCompare(b));

    const importedIds = new Set<string>();
    let importedCount = 0;
    let skippedCount = 0;

    for (const relativePath of relativeFiles) {
      const adapter = this.registry.findImportAdapter(relativePath);
      if (!adapter) {
        skippedCount += 1;
        continue;
      }

      const importResult = await adapter.importFromSfdx(options.sourceRoot, relativePath);
      if (!importResult) {
        skippedCount += 1;
        continue;
      }

      if (importedIds.has(importResult.component.id)) {
        continue;
      }

      importedIds.add(importResult.component.id);

      const toonAssets: ToonAsset[] = [];
      for (const asset of importResult.assets) {
        const content = await fs.promises.readFile(asset.from);
        const hash = sha256(content);
        toonAssets.push({
          path: asset.to,
          role: asset.role,
          sha256: hash,
        });

        await copyFileWithDirs(asset.from, path.join(options.toonRoot, asset.to));
      }

      const component = this.createComponent(importResult.component, toonAssets);
      const toonPayload = importResult.toonPayload ?? component;
      await writeToonFile(path.join(options.toonRoot, importResult.toonFilePath), toonPayload);
      importedCount += 1;
    }

    return {
      importedCount,
      skippedCount,
    };
  }

  private createComponent(componentDraft: ToonComponentDraft, assets: ToonAsset[]): ToonComponent {
    const withAssets: Omit<ToonComponent, 'hash'> = {
      ...componentDraft,
      ...(assets.length ? { assets } : {}),
    };

    const hash = sha256(stableStringify(withAssets));
    return {
      ...withAssets,
      hash,
    };
  }
}
