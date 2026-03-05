import fs from 'fs';
import path from 'path';
import { MetadataAdapter, EmitContext, ImportResult } from '../types/adapter';
import { ToonComponent } from '../types/toon';
import { copyFileWithDirs, ensureDir } from '../utils/fs';
import { extractApiVersion, sanitizePathSegment, wrapMetadataXml } from '../utils/xml';
import { DEFAULT_API_VERSION } from '../../constants/metadata';
import { parseXmlToToonPayload } from '../utils/xmlToToon';

const AURA_META_REGEX = /^aura\/([^/]+)\/\1\.[^/]+-meta\.xml$/;

export class AuraBundleAdapter implements MetadataAdapter {
  readonly metadataType = 'AuraDefinitionBundle';

  isPrimarySfdxFile(relativePath: string): boolean {
    return AURA_META_REGEX.test(relativePath.replace(/\\/g, '/'));
  }

  async importFromSfdx(sourceRoot: string, relativePath: string): Promise<ImportResult | null> {
    const normalized = relativePath.replace(/\\/g, '/');
    const match = normalized.match(AURA_META_REGEX);

    if (!match) {
      return null;
    }

    const bundleName = match[1];
    const safeName = sanitizePathSegment(bundleName);
    const bundleDir = path.join(sourceRoot, 'aura', bundleName);
    const entries = await fs.promises.readdir(bundleDir);
    const metaFileName = path.basename(relativePath);
    const metaXml = await fs.promises.readFile(path.join(sourceRoot, normalized), 'utf8');
    const toonPayload = parseXmlToToonPayload(metaXml);

    const assets = entries
      .filter((entry) => !entry.endsWith('-meta.xml'))
      .map((entry) => ({
        from: path.join(bundleDir, entry),
        to: `aura/${safeName}/${entry}`,
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
          metaFileName,
        },
      },
      toonFilePath: `aura/${safeName}/${toToonFileName(metaFileName)}`,
      toonPayload,
      assets,
    };
  }

  async emitMdapi(component: ToonComponent, _toonFilePath: string, context: EmitContext): Promise<void> {
    const targetDir = path.join(context.mdapiRoot, 'aura', component.fullName);
    await ensureDir(targetDir);

    for (const asset of component.assets || []) {
      await copyFileWithDirs(path.join(context.toonRoot, asset.path), path.join(targetDir, path.basename(asset.path)));
    }

    const metaFileName = typeof component.spec.metaFileName === 'string' && component.spec.metaFileName.trim().length > 0
      ? component.spec.metaFileName
      : `${component.fullName}.cmp-meta.xml`;

    const metaXml = typeof component.spec.metaXml === 'string' && component.spec.metaXml.trim().length > 0
      ? component.spec.metaXml
      : this.createFallbackMetaXml(component.apiVersion);

    await fs.promises.writeFile(path.join(targetDir, metaFileName), metaXml, 'utf8');
  }

  toPackageMember(component: Pick<ToonComponent, 'metadataType' | 'fullName'>): { type: string; member: string } | null {
    return { type: this.metadataType, member: component.fullName };
  }

  private createFallbackMetaXml(apiVersion?: string): string {
    const inner = `  <apiVersion>${apiVersion || DEFAULT_API_VERSION}</apiVersion>`;
    return wrapMetadataXml('AuraDefinitionBundle', inner);
  }
}

function toToonFileName(xmlFileName: string): string {
  return xmlFileName.replace(/\.xml$/i, '.toon');
}
