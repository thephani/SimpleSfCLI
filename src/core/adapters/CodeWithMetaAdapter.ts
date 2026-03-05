import fs from 'fs';
import path from 'path';
import { DEFAULT_API_VERSION } from '../../constants/metadata';
import { MetadataAdapter, EmitContext, ImportResult } from '../types/adapter';
import { ToonComponent } from '../types/toon';
import { copyFileWithDirs, ensureDir } from '../utils/fs';
import { extractApiVersion, wrapMetadataXml } from '../utils/xml';
import { parseXmlToToonPayload } from '../utils/xmlToToon';

interface CodeWithMetaConfig {
  metadataType: string;
  rootTag: string;
  sfdxFolder: string;
  toonFolder: string;
  bodyExtension: string;
  metaExtension: string;
  defaultStatus?: 'Active' | 'Deleted';
}

export class CodeWithMetaAdapter implements MetadataAdapter {
  readonly metadataType: string;

  private readonly rootTag: string;

  private readonly sfdxFolder: string;

  private readonly toonFolder: string;

  private readonly bodyExtension: string;

  private readonly metaExtension: string;

  private readonly defaultStatus: 'Active' | 'Deleted';

  constructor(config: CodeWithMetaConfig) {
    this.metadataType = config.metadataType;
    this.rootTag = config.rootTag;
    this.sfdxFolder = config.sfdxFolder;
    this.toonFolder = config.toonFolder;
    this.bodyExtension = config.bodyExtension;
    this.metaExtension = config.metaExtension;
    this.defaultStatus = config.defaultStatus || 'Active';
  }

  isPrimarySfdxFile(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    return normalized.startsWith(`${this.sfdxFolder}/`) && normalized.endsWith(this.metaExtension);
  }

  async importFromSfdx(sourceRoot: string, relativePath: string): Promise<ImportResult | null> {
    if (!this.isPrimarySfdxFile(relativePath)) {
      return null;
    }

    const normalized = relativePath.replace(/\\/g, '/');
    const fileName = path.basename(normalized);
    const fullName = fileName.slice(0, -this.metaExtension.length);
    const sourcePath = path.join(sourceRoot, this.sfdxFolder, `${fullName}${this.bodyExtension}`);
    const metaFileName = `${fullName}${this.metaExtension}`;
    const metaPath = path.join(sourceRoot, normalized);

    let metaXml = '';
    if (fs.existsSync(metaPath)) {
      metaXml = await fs.promises.readFile(metaPath, 'utf8');
    }
    if (!metaXml) {
      metaXml = this.createDefaultMetaXml({
        toonVersion: '1.0',
        id: `${this.metadataType}:${fullName}`,
        metadataType: this.metadataType,
        fullName,
        apiVersion: DEFAULT_API_VERSION,
        kind: 'atomic',
        spec: {},
        hash: '',
      });
    }

    const apiVersion = metaXml ? extractApiVersion(metaXml) : DEFAULT_API_VERSION;
    const toonPayload = parseXmlToToonPayload(metaXml);

    return {
      component: {
        toonVersion: '1.0',
        id: `${this.metadataType}:${fullName}`,
        metadataType: this.metadataType,
        fullName,
        apiVersion,
        kind: 'atomic',
        spec: {
          metaXml,
          bodyFile: `${fullName}${this.bodyExtension}`,
        },
      },
      toonFilePath: `${this.toonFolder}/${toToonFileName(metaFileName)}`,
      toonPayload,
      assets: fs.existsSync(sourcePath)
        ? [
            {
              from: sourcePath,
              to: `${this.toonFolder}/${fullName}${this.bodyExtension}`,
              role: 'source',
            },
          ]
        : [],
    };
  }

  async emitMdapi(component: ToonComponent, _toonFilePath: string, context: EmitContext): Promise<void> {
    for (const asset of component.assets || []) {
      const sourceAssetPath = path.join(context.toonRoot, asset.path);
      const targetPath = path.join(context.mdapiRoot, this.sfdxFolder, path.basename(asset.path));
      await copyFileWithDirs(sourceAssetPath, targetPath);
    }

    const specMeta = component.spec.metaXml;
    const metaXml = typeof specMeta === 'string' && specMeta.trim().length > 0
      ? specMeta
      : this.createDefaultMetaXml(component);

    const metaPath = path.join(context.mdapiRoot, this.sfdxFolder, `${component.fullName}${this.metaExtension}`);
    await ensureDir(path.dirname(metaPath));
    await fs.promises.writeFile(metaPath, metaXml, 'utf8');
  }

  toPackageMember(component: Pick<ToonComponent, 'metadataType' | 'fullName'>): { type: string; member: string } | null {
    return { type: this.metadataType, member: component.fullName };
  }

  private createDefaultMetaXml(component: ToonComponent): string {
    const statusLine = this.defaultStatus ? `  <status>${this.defaultStatus}</status>\n` : '';
    const inner = `  <apiVersion>${component.apiVersion || DEFAULT_API_VERSION}</apiVersion>\n${statusLine}`.trimEnd();
    return wrapMetadataXml(this.rootTag, inner);
  }
}

function toToonFileName(xmlFileName: string): string {
  return xmlFileName.replace(/\.xml$/i, '.toon');
}
