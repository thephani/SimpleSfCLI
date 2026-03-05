import fs from 'fs';
import path from 'path';
import { MetadataAdapter, EmitContext, ImportResult } from '../types/adapter';
import { ToonComponent } from '../types/toon';
import { extractApiVersion, extractXmlInner, sanitizePathSegment } from '../utils/xml';
import { parseXmlToToonPayload } from '../utils/xmlToToon';

const CUSTOM_OBJECT_REGEX = /^objects\/([^/]+)\/\1\.object-meta\.xml$/;

export class CustomObjectAdapter implements MetadataAdapter {
  readonly metadataType = 'CustomObject';

  isPrimarySfdxFile(relativePath: string): boolean {
    return CUSTOM_OBJECT_REGEX.test(relativePath.replace(/\\/g, '/'));
  }

  async importFromSfdx(sourceRoot: string, relativePath: string): Promise<ImportResult | null> {
    const normalized = relativePath.replace(/\\/g, '/');
    const match = normalized.match(CUSTOM_OBJECT_REGEX);

    if (!match) {
      return null;
    }

    const objectName = match[1];
    const xml = await fs.promises.readFile(path.join(sourceRoot, normalized), 'utf8');
    const toonPayload = parseXmlToToonPayload(xml);

    return {
      component: {
        toonVersion: '1.0',
        id: `${this.metadataType}:${objectName}`,
        metadataType: this.metadataType,
        fullName: objectName,
        apiVersion: extractApiVersion(xml),
        kind: 'atomic',
        spec: {
          xml,
        },
      },
      toonFilePath: `objects/${sanitizePathSegment(objectName)}/${toToonFileName(`${objectName}.object-meta.xml`)}`,
      toonPayload,
      assets: [],
    };
  }

  async emitMdapi(component: ToonComponent, _toonFilePath: string, context: EmitContext): Promise<void> {
    const xml = typeof component.spec.xml === 'string' ? component.spec.xml : '';
    if (!xml) {
      throw new Error(`CustomObject component ${component.id} is missing spec.xml`);
    }

    const inner = extractXmlInner(xml, 'CustomObject');
    context.objectBaseInnerXmlByObject.set(component.fullName, inner);
    context.objectApiVersionByObject.set(component.fullName, component.apiVersion);
  }

  toPackageMember(component: Pick<ToonComponent, 'metadataType' | 'fullName'>): { type: string; member: string } | null {
    return { type: this.metadataType, member: component.fullName };
  }
}

function toToonFileName(xmlFileName: string): string {
  return xmlFileName.replace(/\.xml$/i, '.toon');
}
