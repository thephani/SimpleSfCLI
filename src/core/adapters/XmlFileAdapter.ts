import fs from 'fs';
import path from 'path';
import { DEFAULT_API_VERSION } from '../../constants/metadata';
import { MetadataAdapter, EmitContext, ImportResult } from '../types/adapter';
import { ToonComponent } from '../types/toon';
import { ensureDir } from '../utils/fs';
import { extractApiVersion } from '../utils/xml';
import { parseXmlToToonPayload } from '../utils/xmlToToon';

interface XmlFileAdapterConfig {
  metadataType: string;
  sfdxFolder: string;
  toonFolder: string;
  extension: string;
}

export class XmlFileAdapter implements MetadataAdapter {
  readonly metadataType: string;

  private readonly sfdxFolder: string;

  private readonly toonFolder: string;

  private readonly extension: string;

  constructor(config: XmlFileAdapterConfig) {
    this.metadataType = config.metadataType;
    this.sfdxFolder = config.sfdxFolder;
    this.toonFolder = config.toonFolder;
    this.extension = config.extension;
  }

  isPrimarySfdxFile(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    return normalized.startsWith(`${this.sfdxFolder}/`) && normalized.endsWith(this.extension);
  }

  async importFromSfdx(sourceRoot: string, relativePath: string): Promise<ImportResult | null> {
    if (!this.isPrimarySfdxFile(relativePath)) {
      return null;
    }

    const normalized = relativePath.replace(/\\/g, '/');
    const sourcePath = path.join(sourceRoot, normalized);
    const fileName = path.basename(normalized);
    const fullName = fileName.slice(0, -this.extension.length);
    const xml = await fs.promises.readFile(sourcePath, 'utf8');
    const toonFileName = toToonFileName(fileName);
    const toonPayload = parseXmlToToonPayload(xml);

    return {
      component: {
        toonVersion: '1.0',
        id: `${this.metadataType}:${fullName}`,
        metadataType: this.metadataType,
        fullName,
        apiVersion: extractApiVersion(xml) || DEFAULT_API_VERSION,
        kind: 'atomic',
        spec: {
          xml,
        },
      },
      toonFilePath: `${this.toonFolder}/${toonFileName}`,
      toonPayload,
      assets: [],
    };
  }

  async emitMdapi(component: ToonComponent, _toonFilePath: string, context: EmitContext): Promise<void> {
    const xml = typeof component.spec.xml === 'string' ? component.spec.xml : '';

    if (!xml) {
      throw new Error(`Component ${component.id} is missing XML payload in spec.xml`);
    }

    const outputPath = path.join(context.mdapiRoot, this.sfdxFolder, `${component.fullName}${this.extension}`);
    await ensureDir(path.dirname(outputPath));
    await fs.promises.writeFile(outputPath, xml, 'utf8');
  }

  toPackageMember(component: Pick<ToonComponent, 'metadataType' | 'fullName'>): { type: string; member: string } | null {
    return { type: this.metadataType, member: component.fullName };
  }
}

function toToonFileName(xmlFileName: string): string {
  return xmlFileName.replace(/\.xml$/i, '.toon');
}
