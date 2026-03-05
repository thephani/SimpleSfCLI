import fs from 'fs';
import path from 'path';
import { MetadataAdapter, EmitContext, ImportResult } from '../types/adapter';
import { ToonComponent } from '../types/toon';
import { copyFileWithDirs, ensureDir } from '../utils/fs';
import { extractApiVersion, sanitizePathSegment, wrapMetadataXml } from '../utils/xml';
import { DEFAULT_API_VERSION } from '../../constants/metadata';

const LWC_META_REGEX = /^lwc\/([^/]+)\/\1\.js-meta\.xml$/;

export class LwcBundleAdapter implements MetadataAdapter {
  readonly metadataType = 'LightningComponentBundle';

  isPrimarySfdxFile(relativePath: string): boolean {
    return LWC_META_REGEX.test(relativePath.replace(/\\/g, '/'));
  }

  async importFromSfdx(sourceRoot: string, relativePath: string): Promise<ImportResult | null> {
    const normalized = relativePath.replace(/\\/g, '/');
    const match = normalized.match(LWC_META_REGEX);

    if (!match) {
      return null;
    }

    const bundleName = match[1];
    const safeName = sanitizePathSegment(bundleName);
    const bundleDir = path.join(sourceRoot, 'lwc', bundleName);
    const entries = await fs.promises.readdir(bundleDir);
    const metaPath = path.join(bundleDir, `${bundleName}.js-meta.xml`);
    const metaXml = await fs.promises.readFile(metaPath, 'utf8');

    const assets = entries
      .filter((entry) => !entry.endsWith('-meta.xml'))
      .map((entry) => ({
        from: path.join(bundleDir, entry),
        to: `lwc/${safeName}/${entry}`,
        role: 'bundle-asset',
      }));

    return {
      component: {
        toonVersion: '1.0',
        id: `${this.metadataType}:${bundleName}`,
        metadataType: this.metadataType,
        fullName: bundleName,
        apiVersion: extractApiVersion(metaXml),
        kind: 'bundle',
        spec: {
          metaXml,
          metaFileName: `${bundleName}.js-meta.xml`,
        },
      },
      toonFilePath: `lwc/${safeName}/bundle.toon`,
      assets,
    };
  }

  async emitMdapi(component: ToonComponent, _toonFilePath: string, context: EmitContext): Promise<void> {
    const targetDir = path.join(context.mdapiRoot, 'lwc', component.fullName);
    await ensureDir(targetDir);

    for (const asset of component.assets || []) {
      await copyFileWithDirs(path.join(context.toonRoot, asset.path), path.join(targetDir, path.basename(asset.path)));
    }

    const metaXml = typeof component.spec.metaXml === 'string' && component.spec.metaXml.trim().length > 0
      ? component.spec.metaXml
      : this.createFallbackMetaXml(component.fullName, component.apiVersion);

    await fs.promises.writeFile(path.join(targetDir, `${component.fullName}.js-meta.xml`), metaXml, 'utf8');
  }

  toPackageMember(component: Pick<ToonComponent, 'metadataType' | 'fullName'>): { type: string; member: string } | null {
    return { type: this.metadataType, member: component.fullName };
  }

  private createFallbackMetaXml(bundleName: string, apiVersion?: string): string {
    const inner = `  <apiVersion>${apiVersion || DEFAULT_API_VERSION}</apiVersion>\n  <masterLabel>${bundleName}</masterLabel>\n  <isExposed>false</isExposed>`;
    return wrapMetadataXml('LightningComponentBundle', inner);
  }
}
