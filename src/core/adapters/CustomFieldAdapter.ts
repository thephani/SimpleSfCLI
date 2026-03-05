import fs from 'fs';
import path from 'path';
import { MetadataAdapter, EmitContext, ImportResult } from '../types/adapter';
import { ToonComponent } from '../types/toon';
import { extractApiVersion, extractXmlInner, sanitizePathSegment } from '../utils/xml';

const CUSTOM_FIELD_REGEX = /^objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/;

export class CustomFieldAdapter implements MetadataAdapter {
  readonly metadataType = 'CustomField';

  isPrimarySfdxFile(relativePath: string): boolean {
    return CUSTOM_FIELD_REGEX.test(relativePath.replace(/\\/g, '/'));
  }

  async importFromSfdx(sourceRoot: string, relativePath: string): Promise<ImportResult | null> {
    const normalized = relativePath.replace(/\\/g, '/');
    const match = normalized.match(CUSTOM_FIELD_REGEX);

    if (!match) {
      return null;
    }

    const objectName = match[1];
    const fieldName = match[2];
    const fullName = `${objectName}.${fieldName}`;
    const xml = await fs.promises.readFile(path.join(sourceRoot, normalized), 'utf8');

    return {
      component: {
        toonVersion: '1.0',
        id: `${this.metadataType}:${fullName}`,
        metadataType: this.metadataType,
        fullName,
        apiVersion: extractApiVersion(xml),
        kind: 'child',
        parentId: `CustomObject:${objectName}`,
        spec: {
          xml,
          objectName,
          fieldName,
        },
      },
      toonFilePath: `objects/${sanitizePathSegment(objectName)}/fields/${sanitizePathSegment(fieldName)}.toon`,
      assets: [],
    };
  }

  async emitMdapi(component: ToonComponent, _toonFilePath: string, context: EmitContext): Promise<void> {
    const xml = typeof component.spec.xml === 'string' ? component.spec.xml : '';
    if (!xml) {
      throw new Error(`CustomField component ${component.id} is missing spec.xml`);
    }

    const [objectName] = component.fullName.split('.');
    const inner = extractXmlInner(xml, 'CustomField');
    const fragments = context.fieldFragmentsByObject.get(objectName) || [];
    fragments.push(`  <fields>\n${indentXml(inner, 4)}\n  </fields>`);
    context.fieldFragmentsByObject.set(objectName, fragments);
    context.objectApiVersionByObject.set(objectName, component.apiVersion);
  }

  toPackageMember(component: Pick<ToonComponent, 'metadataType' | 'fullName'>): { type: string; member: string } | null {
    return { type: this.metadataType, member: component.fullName };
  }
}

function indentXml(xml: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return xml
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}
